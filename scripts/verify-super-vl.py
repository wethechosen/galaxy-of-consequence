"""Optional Python smoke test. Credentials stay in the process environment.

Uses the user's NVIDIA OpenAI-compatible example, with bounded output and no
reasoning display. It never reads or changes a campaign or sends an image.
"""
import json
import os
from openai import OpenAI

try:
    client = OpenAI(base_url="https://integrate.api.nvidia.com/v1",
                    api_key=os.environ["NVIDIA_API_KEY"], timeout=30, max_retries=0)
    chunks = client.chat.completions.create(
        model="nvidia/nemotron-3.5-super-vl-120b-a12b",
        messages=[{"role": "user", "content": "Reply with exactly READY."}],
        temperature=1, top_p=0.95, max_tokens=128,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}}, stream=True,
    )
    text = "".join(chunk.choices[0].delta.content or "" for chunk in chunks if chunk.choices)
    ready = text.strip() == "READY"
    print(json.dumps({"ready": ready}))
    raise SystemExit(0 if ready else 1)
except Exception as error:
    print(json.dumps({"ready": False, "errorType": type(error).__name__,
                      "status": getattr(error, "status_code", None)}))
    raise SystemExit(1)
