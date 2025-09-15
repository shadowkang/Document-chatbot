import os
from dotenv import load_dotenv
import io
import uuid
import math
import time
import urllib.parse
import requests
from typing import List, Dict
from PyPDF2 import PdfReader
from azure.storage.blob import ContainerClient
from openai import AzureOpenAI
from tqdm import tqdm

load_dotenv()
# ================== 配置 ==================
# Azure Cognitive Search
SEARCH_ENDPOINT = os.getenv("SEARCH_ENDPOINT")
SEARCH_INDEX    = os.getenv("SEARCH_INDEX")
SEARCH_KEY      = os.getenv("SEARCH_KEY")

# Azure OpenAI Embedding
EMBED_ENDPOINT  = os.getenv("EMBED_ENDPOINT")
EMBED_KEY       = os.getenv("EMBED_KEY")
EMBED_MODEL     = os.getenv("EMBED_MODEL", "text-embedding-3-large")  # 可选环境变量，默认值

# Azure Blob
BLOB_CONN_STR   = os.getenv("BLOB_CONN_STR")
BLOB_CONTAINER  = os.getenv("BLOB_CONTAINER")
BLOB_PREFIX     = os.getenv("BLOB_PREFIX", "")   # 可选环境变量，默认空
BLOB_ACCOUNT    = os.getenv("BLOB_ACCOUNT")      # 用于拼直链

# Chunking 策略
CHUNK_SIZE = 1000   # 每段字符数
CHUNK_OVERLAP = 100 # 段落重叠，避免割裂
BATCH_UPLOAD = 500  # 每批最多上传多少个 chunk

# ================== 客户端 ==================
embedding_client = AzureOpenAI(
    api_key=EMBED_KEY, api_version="2024-02-01", azure_endpoint=EMBED_ENDPOINT
)
blob_container = ContainerClient.from_connection_string(BLOB_CONN_STR, BLOB_CONTAINER)

# ================== 工具函数 ==================
def get_embedding(text: str) -> List[float]:
    # 简单的重试
    for attempt in range(3):
        try:
            resp = embedding_client.embeddings.create(model=EMBED_MODEL, input=text)
            return resp.data[0].embedding
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(0.6 * (attempt + 1))

def split_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    text = (text or "").strip()
    if not text:
        return []
    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        chunk = text[start:end]
        chunks.append(chunk)
        if end == n:
            break
        start = end - overlap
        if start < 0:
            start = 0
    return chunks

def build_blob_url(blob_name: str, page_num: int) -> str:
    # 对 blob_name 做 URL 编码，避免空格
    encoded_name = urllib.parse.quote(blob_name)
    return f"https://{BLOB_ACCOUNT}.blob.core.windows.net/{BLOB_CONTAINER}/{encoded_name}#page={page_num}"

def search_invalid_docs(top: int = 1000, skip: int = 0) -> List[Dict]:
    """查找 file==null 或 file=='' 的文档（分页）"""
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX}/docs/search?api-version=2023-07-01-Preview"
    headers = {"Content-Type": "application/json", "api-key": SEARCH_KEY}
    body = {
        "search": "*",
        "filter": "(file eq null) or (file eq '')",
        "top": top,
        "skip": skip,
        "select": "chunk_id,file,page,url"
    }
    r = requests.post(url, headers=headers, json=body, timeout=30)
    r.raise_for_status()
    return r.json().get("value", [])

def delete_docs_by_chunk_ids(chunk_ids: List[str]) -> None:
    if not chunk_ids:
        return
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX}/docs/index?api-version=2023-07-01-Preview"
    headers = {"Content-Type": "application/json", "api-key": SEARCH_KEY}
    actions = [{"@search.action": "delete", "chunk_id": cid} for cid in chunk_ids]
    r = requests.post(url, headers=headers, json={"value": actions}, timeout=60)
    r.raise_for_status()

def cleanup_invalid_docs() -> int:
    """循环分页清理，直到没有无效文档"""
    total_deleted = 0
    while True:
        # 简单分页：每次取 1000 条尝试
        batch = search_invalid_docs(top=1000, skip=0)
        if not batch:
            break
        ids = [doc["chunk_id"] for doc in batch if "chunk_id" in doc]
        delete_docs_by_chunk_ids(ids)
        total_deleted += len(ids)
        print(f"Deleted {len(ids)} invalid docs (accumulated: {total_deleted})")
    return total_deleted

def upload_docs_batched(docs: List[Dict], batch_size: int = BATCH_UPLOAD) -> None:
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX}/docs/index?api-version=2023-07-01-Preview"
    headers = {"Content-Type": "application/json", "api-key": SEARCH_KEY}
    for i in range(0, len(docs), batch_size):
        batch = docs[i:i+batch_size]
        r = requests.post(url, headers=headers, json={"value": batch}, timeout=120)
        try:
            r.raise_for_status()
        except Exception:
            # 打印前 300 字做排查
            print("Index upload error:", r.status_code, r.text[:300])
            raise

def process_pdf_blob(blob_name: str) -> List[Dict]:
    """从 Blob 读取 PDF，切分并生成 chunk 文档"""
    file_name = os.path.basename(blob_name)
    # 提取 folder 名称（顶级目录）
    folder = os.path.dirname(blob_name).split("/")[0] if "/" in blob_name else ""
    print(f"Processing: {file_name} (folder={folder})")

    stream = io.BytesIO(blob_container.download_blob(blob_name).readall())
    reader = PdfReader(stream)
    docs = []

    for page_idx, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text()
        except Exception:
            text = ""
        if not text:
            continue

        for piece in split_text(text):
            vec = get_embedding(piece)
            docs.append({
                "@search.action": "upload",
                "chunk_id": str(uuid.uuid4()),
                "parent_id": file_name,
                "file": file_name,
                "folder": folder,   # 🔹新增字段
                "title": file_name,
                "page": page_idx,
                "url": build_blob_url(blob_name, page_idx),
                "chunk": piece,
                "text_vector": vec
            })
    return docs



def reingest_from_blob(prefix: str = "") -> int:
    """
    遍历整个容器（默认 prefix="" 表示所有），
    对所有 PDF 重新 ingest，并显示进度
    """
    # 先数一数总共有多少 PDF
    blobs = [b for b in blob_container.list_blobs(name_starts_with=prefix) if b.name.lower().endswith(".pdf")]
    total_pdfs = len(blobs)
    print(f"Found {total_pdfs} PDFs to ingest.\n")

    total_chunks = 0

    # tqdm 进度条
    for blob in tqdm(blobs, desc="Ingesting PDFs", unit="pdf"):
        blob_name = blob.name
        docs = process_pdf_blob(blob_name)
        if docs:
            upload_docs_batched(docs)
            total_chunks += len(docs)
            print(f"✅ {os.path.basename(blob_name)} → {len(docs)} chunks (累积: {total_chunks})")
        else:
            print(f"⚠️ Skip {blob_name}: no extractable text.")

    print(f"\n✅ Finished ingesting {total_pdfs} PDFs, total {total_chunks} chunks.")
    return total_chunks


# ================== 主流程 ==================
if __name__ == "__main__":
    print("Step 1/2: Cleaning invalid docs (file is null or empty)...")
    deleted = cleanup_invalid_docs()
    print(f"✅ Cleaned {deleted} docs with empty file field.\n")

    print("Step 2/2: Re-ingesting PDFs from Blob (all folders)...")
    total = reingest_from_blob("")   # 🔹传空字符串，遍历所有 PDF
    print(f"✅ Reindexed {total} chunks in total.")

