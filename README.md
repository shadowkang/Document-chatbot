# Document Chatbot

A full-stack AI-powered document chatbot application that allows users to ask questions about PDF documents using Azure AI services.

## Features

- 📄 PDF document analysis and processing
- 🤖 AI-powered question answering using Azure OpenAI
- 🔍 Semantic search with Azure Cognitive Search
- 💬 Interactive chat interface
- 📊 Document management and preview
- ☁️ Cloud-ready deployment

## Architecture

- **Frontend**: React.js application with modern UI components
- **Backend**: FastAPI server with Azure integrations
- **Storage**: Azure Blob Storage for PDF files
- **Search**: Azure Cognitive Search with vector embeddings
- **AI**: Azure OpenAI for embeddings and chat completions

## Project Structure

```
├── local/                   # Backend API server
│   ├── api_server.py       # Main FastAPI application
│   ├── ingest.py           # PDF processing and indexing
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables (not tracked)
├── local-front/            # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API service layer
│   │   └── App.js         # Main application component
│   ├── public/
│   └── package.json       # Node.js dependencies
└── .gitignore             # Git ignore rules
```

## Setup & Installation

### Prerequisites

- Python 3.8+
- Node.js 16+
- Azure subscription with the following services:
  - Azure OpenAI
  - Azure Cognitive Search
  - Azure Blob Storage

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd local
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create a `.env` file with your Azure credentials:
   ```env
   SEARCH_ENDPOINT=your_search_endpoint
   SEARCH_INDEX=your_search_index
   SEARCH_KEY=your_search_key
   EMBED_ENDPOINT=your_embedding_endpoint
   EMBED_KEY=your_embedding_key
   CHAT_ENDPOINT=your_chat_endpoint
   CHAT_KEY=your_chat_key
   BLOB_CONN_STR=your_blob_connection_string
   BLOB_CONTAINER=your_blob_container
   BLOB_ACCOUNT=your_blob_account
   ```

4. Start the backend server:
   ```bash
   uvicorn api_server:app --reload --port 8000
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd local-front
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000` with the API running on `http://localhost:8000`.

## API Endpoints

- `POST /ask` - Ask questions about documents
- `GET /list-cloud-pdfs` - List available PDF documents
- `GET /inspect/{pdf_name}` - Get document details and pages
- `GET /` - Health check

## Usage

1. Upload PDF documents to your Azure Blob Storage container
2. Run the ingestion process to index documents:
   ```bash
   cd local
   python ingest.py
   ```
3. Start both frontend and backend servers
4. Open the web interface and start asking questions about your documents

## Deployment

### Azure Web App

The application is designed for easy deployment to Azure Web App:

1. Set environment variables in Azure Web App configuration
2. Deploy the backend (`local/`) to an Azure Web App
3. Build and deploy the frontend to Azure Static Web Apps or another hosting service

### Environment Variables

All sensitive configuration is managed through environment variables. Make sure to set these in your deployment environment:

- Azure Search credentials
- Azure OpenAI endpoints and keys
- Azure Blob Storage connection string

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions, please open an issue in the GitHub repository.