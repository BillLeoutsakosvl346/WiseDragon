# infra/modal/uground_vllm.py
import modal, subprocess
from huggingface_hub import snapshot_download

app = modal.App("uground-vllm")
MODEL = "osunlp/UGround-V1-2B"
PORT = 8000

hf_cache = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vllm_cache = modal.Volume.from_name("vllm-cache", create_if_missing=True)

image = (
    modal.Image.from_registry("nvidia/cuda:12.8.0-devel-ubuntu22.04", add_python="3.12")
    .uv_pip_install(  # let vLLM pull compatible torch/flashinfer wheels
        "vllm[flashinfer]==0.10.2",
        "huggingface_hub[hf_transfer]==0.34.4",
    )
    .env({
        "HF_HUB_ENABLE_HF_TRANSFER": "1",
        "VLLM_USE_V1": "1",
        "HF_HOME": "/root/.cache/huggingface",
    })
)

@app.function(
    image=image, gpu="A10G", timeout=600, scaledown_window=15 * 60,
    volumes={"/root/.cache/huggingface": hf_cache, "/root/.cache/vllm": vllm_cache},
)
@modal.web_server(port=PORT, startup_timeout=10 * 60, requires_proxy_auth=True)
def serve():
    cmd = [
        "vllm", "serve", MODEL,
        "--host", "0.0.0.0", "--port", str(PORT),
        "--dtype", "float16",
        "--trust-remote-code",
        "--gpu-memory-utilization", "0.92",
        "--uvicorn-log-level", "info",
    ]
    print("Launching:", " ".join(cmd))
    subprocess.Popen(cmd)

@app.function(image=image, volumes={"/root/.cache/huggingface": hf_cache})
def prefetch():
    snapshot_download(repo_id=MODEL)

@app.local_entrypoint()
def show_url():
    print("Server URL:", serve.web_url)
