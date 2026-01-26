import base64
import json
import logging
import os
from abc import ABC, abstractmethod
from typing import List, Optional

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    @abstractmethod
    async def generate_function(
        self,
        prompt: str,
        system_instruction: str,
        existing_code: str = "",
        existing_description: str = "",
        urls: List[str] = None,
        image: Optional[str] = None,
    ) -> dict:
        pass

    @abstractmethod
    def is_enabled(self) -> bool:
        pass

    def _build_user_prompt(
        self,
        prompt: str,
        urls: List[str] = None,
        existing_code: str = "",
        existing_description: str = "",
    ) -> str:
        """Centralized helper to build the standard user prompt across providers."""
        user_prompt = f"Prompt: {prompt}\n"
        if urls:
            user_prompt += "\nReference URLs:\n" + "\n".join(urls) + "\n"
        if existing_code:
            user_prompt += (
                f"Existing Code:\n{existing_code}\n"
                "Update the existing code based on the prompt, or rewrite it if requested.\n"
            )
        if existing_description:
            user_prompt += (
                f"\nExisting Description:\n{existing_description}\n"
                "Ensure the new description remains consistent with existing background info "
                "unless otherwise instructed.\n"
            )
        return user_prompt


class GeminiProvider(AIProvider):
    @staticmethod
    def is_enabled() -> bool:
        return bool(os.getenv("GEMINI_API_KEY"))

    def __init__(self):
        try:
            from google import genai

            self.api_key = os.getenv("GEMINI_API_KEY")
            self.client = genai.Client(api_key=self.api_key) if self.api_key else None
            self.model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        except ImportError:
            self.client = None
            self.api_key = None
            self.model = None

    async def generate_function(
        self,
        prompt: str,
        system_instruction: str,
        existing_code: str = "",
        existing_description: str = "",
        urls: List[str] = None,
        image: Optional[str] = None,
    ) -> dict:
        from google import genai

        if not self.client:
            raise Exception("Gemini API key not configured")

        user_prompt = self._build_user_prompt(prompt, urls, existing_code, existing_description)
        parts = [genai.types.Part.from_text(text=user_prompt)]

        if image:
            if "," in image:
                header, encoded = image.split(",", 1)
                mime_type = header.split(":")[1].split(";")[0]
            else:
                encoded = image
                mime_type = "image/png"
            image_bytes = base64.b64decode(encoded)
            parts.append(genai.types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

        tools = [
            genai.types.Tool(url_context=genai.types.UrlContext()),
            genai.types.Tool(google_search=genai.types.GoogleSearch()),
        ]

        response = self.client.models.generate_content(
            model=self.model,
            contents=[genai.types.Content(role="user", parts=parts)],
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                tools=tools,
            ),
        )
        return json.loads(response.text)


class OpenAIProvider(AIProvider):
    @staticmethod
    def is_enabled() -> bool:
        return bool(os.getenv("OPENAI_API_KEY"))

    def __init__(self):
        try:
            from openai import OpenAI

            self.api_key = os.getenv("OPENAI_API_KEY")
            self.client = OpenAI(api_key=self.api_key) if self.api_key else None
            self.model = os.getenv("OPENAI_MODEL", "o4-mini")
        except ImportError:
            self.client = None
            self.api_key = None

    async def generate_function(
        self,
        prompt: str,
        system_instruction: str,
        existing_code: str = "",
        existing_description: str = "",
        urls: List[str] = None,
        image: Optional[str] = None,
    ) -> dict:
        if not self.client:
            raise Exception("OpenAI API key not configured")

        user_prompt = self._build_user_prompt(prompt, urls, existing_code, existing_description)
        user_content = [{"type": "text", "text": user_prompt}]

        if image:
            if not image.startswith("data:"):
                image = f"data:image/png;base64,{image}"
            user_content.append({"type": "image_url", "image_url": {"url": image}})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)


class BedrockProvider(AIProvider):
    @staticmethod
    def is_enabled() -> bool:
        return (
            bool(os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"))
            or bool(os.getenv("AWS_PROFILE"))
            or bool(os.getenv("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI"))
        )

    def __init__(self):
        try:
            import boto3

            self.region = os.getenv("AWS_REGION", "us-east-1")
            self.model_id = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0")
            self.client = boto3.client("bedrock-runtime", region_name=self.region)
        except (ImportError, Exception):
            self.client = None

    async def generate_function(
        self,
        prompt: str,
        system_instruction: str,
        existing_code: str = "",
        existing_description: str = "",
        urls: List[str] = None,
        image: Optional[str] = None,
    ) -> dict:
        if not self.client:
            raise Exception("AWS/Bedrock not configured")

        user_prompt = self._build_user_prompt(prompt, urls, existing_code, existing_description)
        content = [{"text": user_prompt}]

        if image:
            if "," in image:
                header, encoded = image.split(",", 1)
                mime_type = header.split(":")[1].split(";")[0]
                ext = mime_type.split("/")[-1]
                if ext == "jpeg":
                    ext = "jpg"
            else:
                encoded = image
                ext = "png"

            content.append(
                {
                    "image": {
                        "format": ext,
                        "source": {"bytes": base64.b64decode(encoded)},
                    }
                }
            )

        body = json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "system": system_instruction,
                "messages": [{"role": "user", "content": content}],
            }
        )

        response = self.client.invoke_model(modelId=self.model_id, body=body)
        response_body = json.loads(response.get("body").read())
        result_text = response_body["content"][0]["text"]

        # Extract JSON if wrapped in markdown
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()

        return json.loads(result_text)


def get_provider(provider_name: Optional[str] = None) -> AIProvider:
    if not provider_name:
        provider_name = os.getenv("DEFAULT_AI_PROVIDER", "gemini")

    if provider_name == "gemini":
        return GeminiProvider()
    if provider_name == "openai":
        return OpenAIProvider()
    if provider_name == "bedrock":
        return BedrockProvider()
    raise Exception(f"Unknown AI provider: {provider_name}")


def get_available_providers() -> List[str]:
    providers = []
    if GeminiProvider.is_enabled():
        providers.append("gemini")
    if OpenAIProvider.is_enabled():
        providers.append("openai")
    if BedrockProvider.is_enabled():
        providers.append("bedrock")
    return providers
