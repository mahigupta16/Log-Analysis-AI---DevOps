import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
import groq

# Load environment variables
load_dotenv(override=True)

class AIAssistantService:
    def __init__(self):
        self.gemini_key = os.getenv("GEMINI_API_KEY", "")
        self.groq_key = os.getenv("GROQ_API_KEY", "")
        
        self.gemini_client = None
        if self.gemini_key and "YOUR_GEMINI_API_KEY" not in self.gemini_key:
            self.gemini_client = genai.Client(api_key=self.gemini_key)
            
        self.groq_client = None
        if self.groq_key and "YOUR_GROQ_API_KEY" not in self.groq_key:
            self.groq_client = groq.Client(api_key=self.groq_key)

    def _get_gemini_client(self):
        # Reload env just in case keys changed during runtime
        load_dotenv(override=True)
        key = os.getenv("GEMINI_API_KEY", "")
        if key and "YOUR_GEMINI_API_KEY" not in key:
            return genai.Client(api_key=key)
        return None

    def explain_log(self, log_text: str) -> str:
        """
        Analyze the log, explain errors, identify causes, suggest fixes, and provide troubleshooting commands.
        """
        client = self._get_gemini_client()
        if not client:
            return "Error: Gemini API key is not configured. Please set GEMINI_API_KEY in the .env file."
            
        prompt = f"""You are an expert DevOps engineer.

Analyze the following log:

{log_text}

Return:

1. Error explanation
2. Possible cause
3. Severity level
4. Suggested fixes
5. Linux commands if needed
6. Prevention recommendations

Format your output in professional Markdown. Use headings, bullet points, and code blocks for readability."""

        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            return response.text
        except Exception as e:
            print(f"[AI Assistant] Error explaining log: {e}")
            return f"Error explaining log via AI: {str(e)}"

    def generate_bash_script(self, log_text: str) -> str:
        """
        Generate executable Linux fix commands as a bash script.
        """
        client = self._get_gemini_client()
        if not client:
            return "# Error: Gemini API key is not configured."
            
        prompt = f"""You are a senior Linux System Administrator.
Given the following error log, write a complete, executable bash script to fix the issue.
Include comments explaining what each command does.

Log:
{log_text}

Output ONLY the bash script, enclosed in a markdown bash code block."""

        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            return response.text
        except Exception as e:
            return f"Error generating script: {str(e)}"

    def suggest_k8s_fix(self, log_text: str) -> str:
        """
        Provide Kubernetes specific fix suggestions.
        """
        client = self._get_gemini_client()
        if not client:
            return "Error: Gemini API key is not configured."
            
        prompt = f"""You are a Certified Kubernetes Administrator (CKA).
Analyze the following log and provide Kubernetes-specific commands and yaml snippet fixes (e.g., pod restart, deployment fixes, scaling recommendations).

Log:
{log_text}

Format the response in Markdown."""

        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            return response.text
        except Exception as e:
            return f"Error generating Kubernetes fixes: {str(e)}"

    async def chat_with_context(self, message: str, context: dict, history: list) -> str:
        """
        Handle conversational questions regarding the log or issue.
        """
        client = self._get_gemini_client()
        if not client:
            return "Error: Gemini API key is not configured."
            
        system_prompt = (
            "You are a Senior DevOps AI Expert and a friendly mentor. "
            f"CONTEXT OF THE CURRENT LOG FILE:\n{context.get('log')}\n\n"
            f"DETECTION RESULT:\n{context.get('result')}\n\n"
            "INSTRUCTIONS:\n"
            "1. Answer user's follow-up questions clearly and simply.\n"
            "2. Keep the context of the error in mind.\n"
            "3. Format your output in Markdown.\n"
        )

        full_prompt = system_prompt + "\n\nCHAT HISTORY:\n"
        for msg in history:
            role = "User" if msg['role'] == 'user' else "AI"
            full_prompt += f"{role}: {msg['content']}\n"
        
        full_prompt += f"\nUser Question: {message}\nAI Reply:"

        try:
            # Using async SDK for chat
            response = await client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=full_prompt
            )
            return response.text
        except Exception as e:
            return f"AI Error: {str(e)}"

# Singleton instance
ai_assistant_service = AIAssistantService()
