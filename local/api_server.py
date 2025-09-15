from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AzureOpenAI
import requests, os, urllib.parse
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient

# ========= Azure Fixed Configuration (Environment Variables) =========
load_dotenv()
# 1. Azure Search
SEARCH_ENDPOINT = os.getenv("SEARCH_ENDPOINT")
SEARCH_INDEX    = os.getenv("SEARCH_INDEX")
SEARCH_KEY      = os.getenv("SEARCH_KEY")

# 2. OpenAI - Embedding
EMBED_ENDPOINT  = os.getenv("EMBED_ENDPOINT")
EMBED_KEY       = os.getenv("EMBED_KEY")

# 3. OpenAI - Chat
CHAT_ENDPOINT   = os.getenv("CHAT_ENDPOINT")
CHAT_KEY        = os.getenv("CHAT_KEY")

# 4. Blob Storage
BLOB_CONN_STR   = os.getenv("BLOB_CONN_STR")
BLOB_CONTAINER  = os.getenv("BLOB_CONTAINER")
BLOB_ACCOUNT    = os.getenv("BLOB_ACCOUNT")   # For assembling linear chains

# ========= OpenAI Clients =========
embedding_client = AzureOpenAI(
    api_key=EMBED_KEY, api_version="2024-02-01", azure_endpoint=EMBED_ENDPOINT
)
chat_client = AzureOpenAI(
    api_key=CHAT_KEY, api_version="2024-02-01", azure_endpoint=CHAT_ENDPOINT
)

# ========= FastAPI Initialization =========
app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

class AskRequest(BaseModel):
    query: str
    top_k: int | None = 5


# ---------- helpers ----------
def get_embedding(text: str) -> list[float]:
    resp = embedding_client.embeddings.create(model="text-embedding-3-large", input=text)
    return resp.data[0].embedding

def search_docs(query: str, top_k: int = 5):
    """Call Azure Search to perform hybrid (keyword + vector + semantic reranker)"""
    vec = get_embedding(query)
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX}/docs/search?api-version=2023-07-01-Preview"
    headers = {"Content-Type": "application/json", "api-key": SEARCH_KEY}

    body = {
        "search": query,
        "vectors": [
            {
                "value": vec,
                "fields": "text_vector",
                "k": top_k
            }
        ],
        "queryType": "semantic",   # 🔹Enable semantic search
        "semanticConfiguration": "kattsafe-rag-semantic-configuration",  # 🔹Use the semantic config defined in your index
        "top": top_k
        #  Not adding select → defaults to returning all fields, including file, folder, url, page, @search.score
    }

    r = requests.post(url, headers=headers, json=body, timeout=30)
    try:
        r.raise_for_status()
        return r.json().get("value", [])
    except requests.exceptions.HTTPError:
        print("Azure Search Error:", r.status_code, r.text)
        return {"error": r.text, "status_code": r.status_code}


def answer_with_gpt(query: str, docs: list[dict]) -> dict:
    # If no retrieval results or errors occur
    if not docs or (isinstance(docs, dict) and docs.get("error")):
        if isinstance(docs, dict) and docs.get("error"):
            return {
                "answer": f"Azure Search Error: {docs['error']}",
                "reference": None,
                "confidence": 0
            }
        system = "You are a helpful assistant."
        user = f"No relevant documents found. Still answer concisely if you can.\n\nQuestion: {query}"
        resp = chat_client.chat.completions.create(
            model="gpt-4.1",
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.2
        )
        return {
            "answer": resp.choices[0].message.content,
            "reference": None,
            "confidence": 0
        }

    # Concatenate multiple search results as context
    context_parts = []
    for d in docs[:8]:  # Take the first 8 chunks
        file = d.get("file", "")
        folder = d.get("folder", "")
        page = d.get("page", "")
        chunk_text = d.get("chunk", "")[:1200]  # Each chunk max 1200 characters
        context_parts.append(
            f"[Source: {folder}/{file} | Page {page}]\n{chunk_text}"
        )
    context = "\n\n".join(context_parts)

    # Construct the prompt
    user = (
        "You MUST ONLY use the provided context below to answer.\n"
        "Do NOT use any external knowledge or training data.\n"
        "If the context does not contain the answer, you MUST say 'I could not find this information in the provided document.'\n\n"
        "⚠️ IMPORTANT INSTRUCTIONS:\n"
        "- Only use document chunks that explicitly match the product or model mentioned in the question "
        "(e.g., AP150 Mega Post). Ignore other documents even if they look similar.\n"
        "- Present the answer in a CLEARLY STRUCTURED FORMAT.\n"
        "- Use numbered headings for major categories (1., 2., 3., ...).\n"
        "- Under each heading, use bullet points (-) for details.\n"
        "- Bold important terms (like \"Clearance\", \"Step Ladder 60°\", \"200mm\").\n"
        "- Always include measurement units (mm, m, MPa) after numeric values.\n"
        "- Do NOT merge everything into one long list.\n"
        "- Do NOT add an extra summary at the end. Only the structured list.\n"
        "- If multiple chunks give conflicting values (e.g., 25 MPa vs 32 MPa), explicitly state the differences.\n\n"
        f"Context:\n{context}\n\nQuestion: {query}\n\nAnswer based ONLY on the context above:"
    )

    # GPT Call
    resp = chat_client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "You are a precise assistant."},
            {"role": "user", "content": user}
        ],
        temperature=0.2,
        max_tokens=1500
    )
    ans = resp.choices[0].message.content

    # Reference only keeps the first
    s = docs[0]

    # Calculate confidence percentage
    max_score = max(d.get("@search.score", 0) for d in docs) or 1
    raw_score = s.get("@search.score", 0)
    confidence = int((raw_score / max_score) * 100)

    return {
        "answer": ans,
        "reference": {
            "file": s.get("file", ""),
            "folder": s.get("folder", ""),
            "page": s.get("page", ""),
            "url": s.get("url", "")
        },
        "confidence": confidence
    }




# ---------- routes ----------
@app.post("/ask")
def ask(req: AskRequest):
    docs = search_docs(req.query, top_k=req.top_k or 5)
    result = answer_with_gpt(req.query, docs)
    result["hits"] = len(docs)
    result["markdown"] = True   # Clearly inform the front-end that this is Markdown
    return result

@app.get("/list-cloud-pdfs")
def list_cloud_pdfs():
    try:
        svc = BlobServiceClient.from_connection_string(BLOB_CONN_STR)
        cont = svc.get_container_client(BLOB_CONTAINER)
        items = []
        for b in cont.list_blobs():
            if b.name.lower().endswith(".pdf"):
                items.append({
                    "name": os.path.basename(b.name),
                    "full_path": b.name,
                    "size": b.size,
                    "url": f"https://{BLOB_ACCOUNT}.blob.core.windows.net/{BLOB_CONTAINER}/{urllib.parse.quote(b.name)}"
                })
        return {"pdfs": items, "count": len(items)}
    except Exception as e:
        return {"error": str(e), "pdfs": [], "count": 0}

@app.get("/inspect/{pdf_name}")
def inspect_pdf(pdf_name: str):
    safe = pdf_name.replace("'", "''")
    url = f"{SEARCH_ENDPOINT}/indexes/{SEARCH_INDEX}/docs/search?api-version=2023-07-01-Preview"
    headers = {"Content-Type": "application/json", "api-key": SEARCH_KEY}
    body = {"search": "", "filter": f"file eq '{safe}'", "top": 20, "select": "chunk,file,page,url"}
    
    r = requests.post(url, headers=headers, json=body, timeout=30)
    try:
        r.raise_for_status()
        vals = r.json().get("value", [])
        pages = [{"page":v.get("page"), "preview": (v.get("chunk","")[:200]+"..."), "url": v.get("url","")} for v in vals]
        return {"pdf_name": pdf_name, "total_pages": len(pages), "pages": pages}
    except Exception as e:
        return {"error": str(e), "pdf_name": pdf_name, "total_pages": 0, "pages": []}

@app.get("/")
def root():
    return {"ok": True}
