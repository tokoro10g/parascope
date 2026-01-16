import base64
import json
import logging
import os

from google import genai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

logger = logging.getLogger(__name__)

class GenerateFunctionRequest(BaseModel):
    prompt: str
    existing_code: str = ""
    urls: list[str] = []
    image: str | None = None

class GenerateFunctionResponse(BaseModel):
    title: str
    code: str
    inputs: list[str]
    outputs: list[str]
    description: str

def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    return genai.Client(api_key=api_key)

@router.get("/config")
async def get_genai_config():
    return {"enabled": bool(os.getenv("GEMINI_API_KEY"))}

@router.post("/generate_function", response_model=GenerateFunctionResponse)
async def generate_function(request: GenerateFunctionRequest):
    try:
        client = get_gemini_client()
        
        system_instruction = """
        You are an expert Python engineer helping a user write a function for an engineering calculation tool.
        The user will provide a prompt describing what they want the function to do.
        You must return a JSON object with the following structure:
        {
            "title": "A short, descriptive title for the node (e.g. 'Calculate Area', 'Fetch Data'). Max 3-4 words.",
            "code": "docstrings for the inputs and outputs explaining units. Then python code body. Do not include def function_name(): wrapper. Just write lines of code that use variable names as inputs and assign results to variable names as outputs. math and np are already imported.",
            "inputs": ["list", "of", "input", "variable", "names"],
            "outputs": ["list", "of", "output", "variable", "names"],
            "description": "A markdown description of what the code does. Use KaTeX for any formulas. Do not use headings. Include background information if relevant. If equation number is available, include it."
        }
        
        Rules:
        1. The code should be flat, running top to bottom.
           No function definitions unless helper functions are absolutely needed (but prefer avoiding them).
        2. Input variables will be injected into the local scope.
        3. Output variables must be assigned values by the code.
        4. Be concise.
        5. For KaTeX block math, add empty lines before and after both inside and outside `$$`.
        6. The user may provide URLs for context, use them to inform your code if relevant.
        7. The user may use other languages than English. Try to understand and respond in the same language unless otherwise instructed.
        8. Assume that all the inputs and outputs are scalars or strings.
        
        Examples:
        
        User Prompt: "Calculate the area of a circle"
        Response:
        {
            "title": "Circle Area",
            "code": "\"\"\"\nInputs:\nradius_m: The radius of the circle\n\nOutputs:\narea_m2: The calculated area\n\"\"\"\narea_m2 = np.pi * radius_m**2",
            "inputs": ["radius_m"],
            "outputs": ["area_m2"],
            "description": "Calculates the area of a circle given its radius in meters.\n\n$$\n\nA = \\pi r^2\n\n$$"
        }

        User Prompt: "Calculate the hoop stress for a thin-walled pressure vessel."
        Response:
        {
            "title": "Hoop Stress",
            "code": "\"\"\"\nInputs:\npressure_Pa: Internal pressure\ndiameter_m: Internal diameter\nthickness_m: Wall thickness\n\nOutputs:\nstress_hoop_Pa: Circumferential stress\n\"\"\"\n\nstress_hoop_Pa = (pressure_Pa * diameter_m) / (2 * thickness_m)",
            "inputs": ["pressure_Pa", "diameter_m", "thickness_m"],
            "outputs": ["stress_hoop_Pa"],
            "description": "Calculates the circumferential (hoop) stress in a cylinder assuming thin-wall approximation ($t < D/20$).\n\n$$\n\n\\sigma_\\theta = \\frac{P d}{2t}\n\n$$"
        }
        """
        
        user_prompt = f"Prompt: {request.prompt}\n"
        if request.urls:
            user_prompt += "\nReference URLs:\n" + "\n".join(request.urls) + "\n"

        if request.existing_code:
            user_prompt += f"Existing Code:\n{request.existing_code}\n"
            user_prompt += "Update the existing code based on the prompt, or rewrite it if requested."

        parts = [genai.types.Part.from_text(text=user_prompt)]
        
        if request.image:
            if "," in request.image:
                header, encoded = request.image.split(",", 1)
                mime_type = header.split(":")[1].split(";")[0]
            else:
                encoded = request.image
                mime_type = "image/png"
            
            image_bytes = base64.b64decode(encoded)
            parts.append(genai.types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

        tools = [
            genai.types.Tool(url_context=genai.types.UrlContext()),
            genai.types.Tool(google_search=genai.types.GoogleSearch())
        ]

        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=[genai.types.Content(role="user", parts=parts)],
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                tools=tools
            )
        )
        
        result_text = response.text
        try:
            parsed = json.loads(result_text)
            return GenerateFunctionResponse(
                title=parsed.get("title", ""),
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
