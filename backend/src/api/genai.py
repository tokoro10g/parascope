import json
import logging
import os

import google.generativeai as genai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

logger = logging.getLogger(__name__)

class GenerateFunctionRequest(BaseModel):
    prompt: str
    existing_code: str = ""

class GenerateFunctionResponse(BaseModel):
    code: str
    inputs: list[str]
    outputs: list[str]
    description: str

def get_gemini_model():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    return model

@router.get("/config")
async def get_genai_config():
    return {"enabled": bool(os.getenv("GEMINI_API_KEY"))}

@router.post("/generate_function", response_model=GenerateFunctionResponse)
async def generate_function(request: GenerateFunctionRequest):
    try:
        model = get_gemini_model()
        
        system_prompt = """
        You are an expert Python engineer helping a user write a function for an engineering calculation tool.
        The user will provide a prompt describing what they want the function to do.
        You must return a JSON object with the following structure:
        {
            "code": "The python code. Do not include def function_name(): wrapper. Just write lines of code that use variable names as inputs and assign results to variable names as outputs.",
            "inputs": ["list", "of", "input", "variable", "names"],
            "outputs": ["list", "of", "output", "variable", "names"],
            "description": "A markdown description of what the function does."
        }
        
        Rules:
        1. The code should be flat, running top to bottom.
           No function definitions unless helper functions are absolutely needed (but prefer avoiding them).
        2. Input variables will be injected into the local scope.
        3. Output variables must be assigned values by the code.
        4. Use standard libraries like numpy (as np) and scipy.
        5. Be concise.
        
        Example:
        User Prompt: "Calculate the area of a circle"
        Response:
        {
            "code": "area = np.pi * radius**2",
            "inputs": ["radius"],
            "outputs": ["area"],
            "description": "Calculates the area of a circle given its radius."
        }
        """
        
        user_prompt = f"Prompt: {request.prompt}\n"
        if request.existing_code:
            user_prompt += f"Existing Code:\n{request.existing_code}\n"
            user_prompt += "Update the existing code based on the prompt, or rewrite it if requested."

        response = model.generate_content(
            contents=[system_prompt, user_prompt],
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        result_text = response.text
        try:
            parsed = json.loads(result_text)
            return GenerateFunctionResponse(
                code=parsed.get("code", ""),
                inputs=parsed.get("inputs", []),
                outputs=parsed.get("outputs", []),
                description=parsed.get("description", "")
            )
        except json.JSONDecodeError as err:
            logger.error(f"Failed to parse Gemini response: {result_text}")
            raise HTTPException(status_code=500, detail="AI returned invalid JSON") from err

    except Exception as e:
        logger.error(f"Gemini API error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e
