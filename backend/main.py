from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import httpx
import json
import io
import sys
import traceback
import re
import pandas as pd
import pdfplumber
import numpy as np
import matplotlib
matplotlib.use('Agg')  # 使用非交互式后端
import matplotlib.pyplot as plt
import seaborn as sns

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

# 系统提示词 - 告诉大模型可以使用代码执行功能
SYSTEM_INSTRUCTION = """You are Athlon Agent, an AI assistant with code execution capabilities.

IMPORTANT CAPABILITIES:
1. **Code Execution**: You can write and execute Python code to analyze files and data.
2. **File Access**: When a user uploads a file, you will be informed of the file path. You can write code to read and analyze it.
3. **Data Analysis**: You can use pandas, matplotlib, numpy, seaborn and other libraries to analyze Excel, CSV, PDF files.

AVAILABLE LIBRARIES:
- The following libraries are pre-loaded and available: pandas (pd), numpy (np), matplotlib.pyplot (plt), seaborn (sns), json, pdfplumber
- You can also use import statements to import these libraries: pandas, numpy, matplotlib, matplotlib.pyplot, seaborn, json, io, pdfplumber, openpyxl, datetime, math, etc.
- Dangerous modules (os, sys, subprocess) are not allowed

CODE EXECUTION FORMAT:
- When you need to execute code, provide ONE complete Python code block wrapped in ```python ... ```
- Put ALL your code in a SINGLE code block - do not split code into multiple blocks
- The entire code block will be executed as one unit
- You can use import statements for allowed libraries
- Results will be returned to you for further analysis

FILE PATHS:
- Uploaded files are stored in: /app/uploads/
- You will receive the full file path when a file is uploaded

RESPONSE FORMAT:
- Always use Markdown formatting
- Provide ONE complete code block with all necessary imports and code
- Provide clear explanations of your analysis before or after the code block"""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    filename: Optional[str] = None


def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    """安全的导入函数，只允许导入白名单中的模块"""
    # 允许导入的安全模块白名单
    allowed_modules = {
        'pandas', 'numpy', 'matplotlib', 'seaborn', 'json', 'io', 'pdfplumber', 'openpyxl',
        'datetime', 'date', 'time', 'math', 'statistics', 'collections',
        'itertools', 'functools', 'operator', 're', 'string', 'decimal',
        'csv', 'base64', 'hashlib', 'uuid', 'random', 'copy', 'bisect',
    }
    
    # 处理子模块（如 matplotlib.pyplot）
    base_module = name.split('.')[0]
    
    # 检查基础模块是否在白名单中
    if base_module in allowed_modules:
        try:
            return __import__(name, globals, locals, fromlist, level)
        except ImportError as e:
            # 如果导入失败，抛出更友好的错误
            raise ImportError(f"Failed to import '{name}': {str(e)}")
    
    # 禁止导入
    raise ImportError(f"Import of '{name}' is not allowed. Only safe modules can be imported. Allowed modules include: pandas, numpy, matplotlib, seaborn, json, etc.")


def execute_python_code(code: str, file_path: Optional[str] = None, safe_globals: Dict = None, safe_locals: Dict = None) -> Dict[str, Any]:
    """执行 Python 代码并返回结果"""
    # 安全检查：禁止危险的导入和操作（使用更精确的匹配）
    dangerous_patterns = [
        (r'\bimport\s+os\b', 'import os'),
        (r'\bfrom\s+os\s+import', 'from os import'),
        (r'\bimport\s+subprocess\b', 'import subprocess'),
        (r'\bfrom\s+subprocess\s+import', 'from subprocess import'),
        (r'\bimport\s+sys\b', 'import sys'),
        (r'\bfrom\s+sys\s+import', 'from sys import'),
        (r'__import__\s*\(', '__import__'),  # 禁止直接调用 __import__
        (r'\beval\s*\(', 'eval('),
        (r'\bexec\s*\(', 'exec('),
        (r'\bopen\s*\(', 'open('),  # 允许在安全上下文中使用，但禁止直接调用
        (r'\bfile\s*\(', 'file('),  # 禁止 Python 2 的 file()，但允许方法调用如 pd.ExcelFile()
        (r'\binput\s*\(', 'input('),
        (r'\braw_input\s*\(', 'raw_input('),
    ]
    
    import re
    code_lower = code.lower()
    for pattern, description in dangerous_patterns:
        # 使用正则表达式进行更精确的匹配
        if re.search(pattern, code_lower):
            # 特殊处理：允许 pd.ExcelFile() 等对象方法调用
            if description == 'file(':
                # 检查是否是方法调用（如 pd.ExcelFile(), xls.ExcelFile()），而不是独立的 file() 函数
                # 如果 file( 前面有 . 或 =，说明是方法调用或赋值，允许
                matches = list(re.finditer(r'\bfile\s*\(', code_lower))
                is_dangerous = False
                for match in matches:
                    pos = match.start()
                    # 检查 file( 前面的字符
                    before = code_lower[max(0, pos-20):pos].strip()
                    # 如果前面有 . 或 =，说明是方法调用或赋值，允许
                    if '.' in before[-5:] or '=' in before[-5:]:
                        continue  # 这是方法调用，允许
                    else:
                        # 检查是否是变量名的一部分（如 myfile()）
                        # 如果 file( 前面是字母数字或下划线，可能是变量名，也允许
                        if pos > 0 and (code_lower[pos-1].isalnum() or code_lower[pos-1] == '_'):
                            continue
                        # 否则认为是危险的 file() 函数调用
                        is_dangerous = True
                        break
                
                if is_dangerous:
                    return {
                        "success": False,
                        "error": f"禁止使用: {description}",
                        "traceback": None
                    }
            else:
                return {
                    "success": False,
                    "error": f"禁止使用: {description}",
                    "traceback": None
                }
    
    # 如果提供了文件路径，验证安全性
    if file_path:
        # 确保文件路径在安全目录内
        abs_file_path = os.path.abspath(file_path)
        abs_upload_dir = os.path.abspath(UPLOAD_DIR)
        if not abs_file_path.startswith(abs_upload_dir):
            return {
                "success": False,
                "error": "文件路径不在允许的目录内",
                "traceback": None
            }
    
    # 创建或使用传入的执行环境（支持代码块之间共享变量）
    if safe_globals is None:
        safe_globals = {
            '__builtins__': {
                'print': print,
                'len': len,
                'str': str,
                'int': int,
                'float': float,
                'list': list,
                'dict': dict,
                'range': range,
                'enumerate': enumerate,
                'zip': zip,
                'max': max,
                'min': min,
                'sum': sum,
                'abs': abs,
                'round': round,
                'sorted': sorted,
                'reversed': reversed,
                'any': any,
                'all': all,
                'isinstance': isinstance,
                'type': type,
                '__import__': safe_import,  # 使用安全的导入函数
            },
            'pd': pd,
            'pandas': pd,
            'json': json,
            'pdfplumber': pdfplumber,
            'io': io,
            'np': np,
            'numpy': np,
            'plt': plt,
            'matplotlib': matplotlib,
            'sns': sns,
            'seaborn': sns,
            'display': print,  # Jupyter 的 display() 函数，用 print 替代
        }
        
        # 如果提供了文件路径，添加到环境
        if file_path:
            safe_globals['file_path'] = file_path
    else:
        # 使用传入的环境，但确保必要的库可用
        if 'pd' not in safe_globals:
            safe_globals['pd'] = pd
            safe_globals['pandas'] = pd
        if 'json' not in safe_globals:
            safe_globals['json'] = json
        if 'pdfplumber' not in safe_globals:
            safe_globals['pdfplumber'] = pdfplumber
        if 'io' not in safe_globals:
            safe_globals['io'] = io
        if 'np' not in safe_globals:
            safe_globals['np'] = np
            safe_globals['numpy'] = np
        if 'plt' not in safe_globals:
            safe_globals['plt'] = plt
            safe_globals['matplotlib'] = matplotlib
        if 'sns' not in safe_globals:
            safe_globals['sns'] = sns
            safe_globals['seaborn'] = sns
        if 'display' not in safe_globals:
            safe_globals['display'] = print  # Jupyter 的 display() 函数，用 print 替代
        if file_path and 'file_path' not in safe_globals:
            safe_globals['file_path'] = file_path
    
    if safe_locals is None:
        safe_locals = {}
    
    safe_locals = {}
    
    # 捕获输出
    old_stdout = sys.stdout
    sys.stdout = captured_output = io.StringIO()
    
    try:
        exec(code, safe_globals, safe_locals)
        output = captured_output.getvalue()
        
        # 获取最后一个表达式的结果（如果有）
        result = None
        if code.strip():
            try:
                # 尝试获取最后一个表达式的结果
                lines = [line.strip() for line in code.strip().split('\n') if line.strip()]
                if lines:
                    last_line = lines[-1]
                    # 只对简单的表达式求值
                    if (not last_line.startswith('#') and 
                        '=' not in last_line and 
                        'import' not in last_line and
                        'def ' not in last_line and
                        'class ' not in last_line):
                        result = eval(last_line, safe_globals, safe_locals)
                        # 如果是 DataFrame 或其他复杂对象，转换为字符串
                        if hasattr(result, 'to_string'):
                            result = result.to_string()
                        elif isinstance(result, pd.DataFrame):
                            result = result.to_string()
            except:
                pass
        
        return {
            "success": True,
            "output": output,
            "result": str(result) if result is not None else None
        }
    except Exception as e:
        error_trace = traceback.format_exc()
        return {
            "success": False,
            "error": str(e),
            "traceback": error_trace
        }
    finally:
        sys.stdout = old_stdout


def extract_code_blocks(text: str) -> List[str]:
    """从文本中提取 Python 代码块"""
    # 匹配 ```python ... ``` 格式
    pattern = r'```python\s*\n(.*?)```'
    matches = re.findall(pattern, text, re.DOTALL)
    return matches


async def process_llm_response_with_code_execution(
    response_content: str,
    file_path: Optional[str] = None,
    messages: List[Dict[str, str]] = None,
    llm_api_base: str = None,
    llm_api_key: str = None,
    llm_model: str = None,
    ollama_host: str = None,
    max_iterations: int = 5
) -> str:
    """处理 LLM 响应，执行其中的代码块，如果出错则反馈给 LLM 修复"""
    current_content = response_content
    iteration = 0
    all_execution_results = []  # 保存所有执行结果
    result = None  # 初始化 result 变量
    
    while iteration < max_iterations:
        # 提取代码块
        code_blocks = extract_code_blocks(current_content)
        
        if not code_blocks:
            # 没有代码块，直接返回
            if all_execution_results:
                # 如果有之前的执行结果，添加到响应中
                results_text = "\n\n**代码执行结果:**\n"
                for i, result in enumerate(all_execution_results, 1):
                    if result["success"]:
                        results_text += f"\n```\n"
                        if result.get("output"):
                            results_text += result["output"]
                        if result.get("result"):
                            results_text += f"\n结果: {result['result']}"
                        results_text += f"\n```\n"
                current_content += results_text
            return current_content
        
        # 合并所有代码块为一个完整的代码块执行
        if len(code_blocks) > 1:
            print(f"\n[执行] 发现 {len(code_blocks)} 个代码块，合并为一个完整代码块执行...")
            # 合并所有代码块
            combined_code = "\n\n".join(code_blocks)
            code_blocks = [combined_code]
        else:
            print(f"\n[执行] 发现 1 个代码块，开始执行...")
        
        # 执行完整的代码块（只有一个）
        code = code_blocks[0]
        print(f"[执行] 执行完整代码块...")
        result = execute_python_code(code, file_path)
        execution_results = [result]
        all_execution_results.append(result)
        
        if result["success"]:
            print(f"  ✓ 执行成功")
            if result.get("output"):
                output_preview = result['output'][:500] if len(result['output']) > 500 else result['output']
                print(f"  输出预览: {output_preview}...")
        else:
            print(f"  ✗ 执行失败: {result.get('error', 'Unknown error')}")
        
        # 如果代码执行成功，将结果添加到响应中
        if result["success"]:
            results_text = "\n\n**代码执行结果:**\n"
            results_text += f"```\n"
            if result.get("output"):
                results_text += result["output"]
            if result.get("result"):
                results_text += f"\n结果: {result['result']}"
            results_text += f"\n```\n"
            
            current_content += results_text
            return current_content
        else:
            # 有错误，需要让 LLM 修复代码
            print(f"\n{'='*60}")
            print(f"[代码执行错误] 迭代次数: {iteration + 1}/{max_iterations}")
            print(f"{'='*60}")
            
            error_info = f"代码执行失败:\n"
            error_info += f"错误: {result.get('error', 'Unknown error')}\n"
            if result.get("traceback"):
                error_info += f"详细错误信息:\n{result['traceback']}\n"
            
            # 打印错误日志到控制台
            print(f"\n[错误] 代码执行失败:")
            print(f"  错误类型: {result.get('error', 'Unknown error')}")
            if result.get("traceback"):
                print(f"  详细堆栈:\n{result['traceback']}")
            print(f"  执行的代码:\n{code[:500]}...")  # 只打印前500字符
            print("-" * 60)
            
            # 构建错误反馈消息
            error_feedback = "\n\n**代码执行出现错误，请修复代码后重新执行:**\n\n"
            error_feedback += f"```\n{error_info}\n```\n"
            error_feedback += "\n请分析错误原因，修改代码并重新提供一个完整的 Python 代码块（所有代码放在一个 ```python ... ``` 块中）。"
            
            print(f"\n[操作] 将错误信息发送给 LLM 进行修复...")
            
            # 将错误信息添加到消息历史中
            if messages:
                messages.append({"role": "assistant", "content": current_content})
                messages.append({"role": "user", "content": error_feedback})
            
            # 调用 LLM 获取修复后的代码
            try:
                print(f"[操作] 调用 LLM API 获取修复后的代码...")
                if llm_api_base and llm_api_key:
                    # 使用自定义 LLM API
                    async with httpx.AsyncClient() as client:
                        endpoint = llm_api_base.rstrip('/')
                        if endpoint.endswith('/chat/completions'):
                            pass
                        elif endpoint.endswith('/v1'):
                            endpoint = endpoint + '/chat/completions'
                        elif '/v1/' in endpoint:
                            endpoint = endpoint.rstrip('/') + '/chat/completions'
                        else:
                            endpoint = endpoint + '/v1/chat/completions'
                        
                        response = await client.post(
                            endpoint,
                            headers={
                                "Authorization": f"Bearer {llm_api_key}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "model": llm_model,
                                "messages": messages
                            },
                            timeout=600.0
                        )
                        
                        if response.status_code == 200:
                            data = response.json()
                            current_content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                            print(f"[成功] LLM 返回修复后的代码，准备重新执行...")
                            iteration += 1
                            continue
                        else:
                            # LLM 调用失败，返回当前内容（包含错误信息）
                            print(f"[错误] LLM API 调用失败: {response.status_code} - {response.text}")
                            current_content += error_feedback
                            return current_content
                elif ollama_host:
                    # 使用 Ollama
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            f"{ollama_host}/api/chat",
                            json={
                                "model": llm_model,
                                "messages": messages,
                                "stream": False
                            },
                            timeout=60.0
                        )
                        
                        if response.status_code == 200:
                            data = response.json()
                            current_content = data.get("message", {}).get("content", "")
                            print(f"[成功] Ollama 返回修复后的代码，准备重新执行...")
                            iteration += 1
                            continue
                        else:
                            print(f"[错误] Ollama API 调用失败: {response.status_code} - {response.text}")
                            current_content += error_feedback
                            return current_content
                else:
                    # 没有配置 LLM，返回错误信息
                    print(f"[错误] 未配置 LLM API，无法修复代码")
                    current_content += error_feedback
                    return current_content
            except Exception as e:
                # LLM 调用异常，返回当前内容
                print(f"[异常] LLM 调用异常: {str(e)}")
                print(f"  异常类型: {type(e).__name__}")
                import traceback
                print(f"  堆栈信息:\n{traceback.format_exc()}")
                current_content += error_feedback
                current_content += f"\n\n注意: 无法联系 LLM 修复代码: {str(e)}"
                return current_content
    
    # 达到最大迭代次数，返回当前内容（包含最后一次的错误信息）
    if result and not result.get("success", True):
        print(f"\n{'='*60}")
        print(f"[警告] 达到最大迭代次数 ({max_iterations})，停止重试")
        print(f"{'='*60}")
        error_feedback = "\n\n**代码执行多次失败，已达到最大重试次数。**\n\n"
        error_msg = result.get('error', 'Unknown error')
        error_feedback += f"最终错误: {error_msg}\n"
        print(f"  最终错误: {error_msg}")
        current_content += error_feedback
        print(f"{'='*60}\n")
    
    return current_content


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
    """处理聊天请求 - 支持代码执行的文件分析"""
    try:
        # 从环境变量读取 LLM 配置（在 Docker 中配置）
        llm_api_base = os.getenv("LLM_API_BASE")
        llm_api_key = os.getenv("LLM_API_KEY")
        llm_model = os.getenv("LLM_MODEL", "gemini-pro")
        ollama_host = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")
        
        # 获取文件路径（如果提供了文件名）
        file_path = None
        if request.filename:
            file_path = os.path.join(UPLOAD_DIR, request.filename)
            if not os.path.exists(file_path):
                file_path = None
        
        # 构建消息（创建副本，避免修改原始数据）
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # 如果有文件，告诉大模型文件路径（而不是读取内容）
        if file_path and messages:
            file_info = f"\n\n**已上传文件信息:**\n- 文件名: {os.path.basename(file_path)}\n- 文件路径: {file_path}\n- 文件大小: {os.path.getsize(file_path)} bytes\n\n你可以编写 Python 代码来读取和分析这个文件。例如使用 pandas 读取 Excel/CSV，或使用 pdfplumber 读取 PDF。"
            messages[-1] = {"role": messages[-1]["role"], "content": messages[-1]["content"] + file_info}
        
        # 添加系统提示（如果是第一条消息）
        if not messages or messages[0]["role"] != "system":
            messages.insert(0, {"role": "system", "content": SYSTEM_INSTRUCTION})
        
        # 保存原始消息列表的副本，用于代码执行错误反馈
        messages_for_code_execution = messages.copy()
        
        # 如果配置了自定义 LLM API，使用自定义 API
        if llm_api_base and llm_api_key:
            # 使用自定义 LLM API (OpenAI/vLLM 兼容)
            async with httpx.AsyncClient() as client:
                # 构建 endpoint URL
                endpoint = llm_api_base.rstrip('/')
                if endpoint.endswith('/chat/completions'):
                    # 已经包含完整路径
                    pass
                elif endpoint.endswith('/v1'):
                    # 已经包含 /v1，只需添加 /chat/completions
                    endpoint = endpoint + '/chat/completions'
                elif '/v1/' in endpoint:
                    # 包含 /v1/，添加 chat/completions
                    endpoint = endpoint.rstrip('/') + '/chat/completions'
                else:
                    # 不包含 /v1，添加 /v1/chat/completions
                    endpoint = endpoint + '/v1/chat/completions'
                
                response = await client.post(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {llm_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": llm_model,
                        "messages": messages
                    },
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    
                    # 处理代码执行（支持错误反馈循环）
                    final_content = await process_llm_response_with_code_execution(
                        content, 
                        file_path,
                        messages_for_code_execution,
                        llm_api_base,
                        llm_api_key,
                        llm_model,
                        None  # ollama_host not used for custom API
                    )
                    
                    return {"role": "assistant", "content": final_content}
                else:
                    error_detail = f"{response.status_code}: {response.text}"
                    print(f"LLM API Error - Endpoint: {endpoint}, Status: {response.status_code}, Response: {response.text}")
                    raise HTTPException(status_code=response.status_code, detail=error_detail)
        
        # 否则使用 Ollama
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ollama_host}/api/chat",
                json={
                    "model": llm_model,
                    "messages": messages,
                    "stream": False
                },
                timeout=60.0
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get("message", {}).get("content", "")
                
                # 处理代码执行（支持错误反馈循环）
                final_content = await process_llm_response_with_code_execution(
                    content,
                    file_path,
                    messages_for_code_execution,
                    None,  # llm_api_base not used for Ollama
                    None,  # llm_api_key not used for Ollama
                    llm_model,
                    ollama_host
                )
                
                return {"role": "assistant", "content": final_content}
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
