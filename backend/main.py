from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import httpx
import json

app = FastAPI(title="CloudOS AI Backend")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制为特定域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确保上传目录存在
UPLOAD_DIR = "/app/uploads"
STATIC_DIR = "/app/static"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: str = "gemini-pro"
    filename: Optional[str] = None
    llm_api_base: Optional[str] = None
    llm_api_key: Optional[str] = None


@app.get("/")
async def root():
    return {"message": "CloudOS AI Backend API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传文件到服务器"""
    try:
        # 保存文件
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        return {
            "filename": file.filename,
            "path": file_path,
            "size": len(content)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")


@app.post("/chat")
async def chat(request: ChatRequest):
    """处理聊天请求"""
    try:
        # 如果提供了自定义 API，使用自定义 API
        if request.llm_api_base and request.llm_api_key:
            # 使用自定义 LLM API
            async with httpx.AsyncClient() as client:
                # 这里可以根据不同的 API 格式进行调整
                # 示例：调用 OpenAI 兼容的 API
                response = await client.post(
                    f"{request.llm_api_base}/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {request.llm_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": request.model,
                        "messages": [{"role": msg.role, "content": msg.content} for msg in request.messages]
                    },
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    return {"role": "assistant", "content": content}
                else:
                    raise HTTPException(status_code=response.status_code, detail=response.text)
        
        # 否则使用默认的 Ollama（如果配置了）
        ollama_host = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")
        
        # 读取上传的文件内容（如果提供了文件名）
        file_content = ""
        if request.filename:
            file_path = os.path.join(UPLOAD_DIR, request.filename)
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    file_content = f.read()
        
        # 构建消息
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # 如果有文件内容，添加到最后一条用户消息
        if file_content and messages:
            messages[-1]["content"] += f"\n\n文件内容:\n{file_content}"
        
        # 调用 Ollama API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ollama_host}/api/chat",
                json={
                    "model": request.model,
                    "messages": messages,
                    "stream": False
                },
                timeout=60.0
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get("message", {}).get("content", "")
                return {"role": "assistant", "content": content}
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama API 错误: {response.text}"
                )
    
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"无法连接到 LLM 服务: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理请求时出错: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
