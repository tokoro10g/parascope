import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.ai_providers import get_available_providers, get_provider

router = APIRouter()

logger = logging.getLogger(__name__)


class GenerateFunctionRequest(BaseModel):
    prompt: str
    existing_code: str = ""
    existing_description: str = ""
    urls: list[str] = []
    image: str | None = None
    provider: str | None = None


class GenerateFunctionResponse(BaseModel):
    title: str
    code: str
    inputs: list[str]
    outputs: list[str]
    description: str


@router.get("/config")
async def get_genai_config():
    return {
        "enabled": len(get_available_providers()) > 0,
        "available_providers": get_available_providers(),
        "default_provider": os.getenv("DEFAULT_AI_PROVIDER", "gemini"),
    }


@router.post("/generate_function", response_model=GenerateFunctionResponse)
async def generate_function(request: GenerateFunctionRequest):
    try:
        provider = get_provider(request.provider)
        
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
        """  # noqa: E501

        parsed = await provider.generate_function(
            prompt=request.prompt,
            system_instruction=system_instruction,
            existing_code=request.existing_code,
            existing_description=request.existing_description,
            urls=request.urls,
            image=request.image,
        )

        return GenerateFunctionResponse(
            title=parsed.get("title", ""),
            code=parsed.get("code", ""),
            inputs=parsed.get("inputs", []),
            outputs=parsed.get("outputs", []),
            description=parsed.get("description", ""),
        )

    except Exception as e:
        logger.error(f"AI Provider error ({request.provider}): {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e
