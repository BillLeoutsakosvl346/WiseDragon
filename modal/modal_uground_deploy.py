"""
Modal UGround Deployment Script - Optimized for San Francisco
Deploys UGround-V1-2B in us-west-2 (Oregon) for minimal latency from SF
"""

import modal
import subprocess

app = modal.App("uground-vllm-uswest")

# -------- Config (corrected parameters) --------
MODEL_NAME = "osunlp/UGround-V1-2B"
SERVED_NAME = "uground-2b"
PORT = 8000
CLOUD = "aws"
REGION = "us-west-2"          # Oregon (lowest RTT from SF on AWS)
GPU = "L4"                    # L4 faster than T4, fallback to "T4" if needed
MIN_CONTAINERS = 1            # keep one warm replica
SCALEDOWN_WINDOW_S = 15 * 60  # when >1 replicas, how long before scale-down
CONCURRENT_INPUTS = 16        # tune per GPU

# -------- Persistent caches (avoid re-downloading) --------
hf_cache = modal.Volume.from_name("huggingface-cache-uswest", create_if_missing=True)
vllm_cache = modal.Volume.from_name("vllm-cache-uswest", create_if_missing=True)

# -------- Base image with CUDA 12.8 + vLLM V1 + flashinfer --------
vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.8.0-devel-ubuntu22.04", add_python="3.12")
    .uv_pip_install(
        # Pin to Modal's example-proven stack
        "vllm==0.10.1.1",
        "huggingface_hub[hf_transfer]==0.34.4",
        "flashinfer-python==0.2.8",
        "torch==2.7.1",
    )
    .env({
        "HF_HUB_ENABLE_HF_TRANSFER": "1",
        "VLLM_USE_V1": "1",                     # vLLM V1 engine
        "HF_HOME": "/root/.cache/huggingface",
    })
)

# Optional: prefetch weights into the HF cache at build-time
def _prefetch():
    from huggingface_hub import snapshot_download
    snapshot_download(
        repo_id=MODEL_NAME,
        local_dir="/root/.cache/huggingface/hub",
        local_dir_use_symlinks=False,
    )

vllm_image = vllm_image.run_function(
    _prefetch,
    volumes={"/root/.cache/huggingface": hf_cache},
)

@app.function(
    image=vllm_image,
    gpu=GPU,                             # L4 for better performance
    cloud=CLOUD,
    region=REGION,                       # aws us-west-2 = Oregon
    timeout=10 * 60,                     # container start timeout
    scaledown_window=SCALEDOWN_WINDOW_S, # correct parameter name
    min_containers=MIN_CONTAINERS,       # always keep this many warm
    volumes={
        "/root/.cache/huggingface": hf_cache,
        "/root/.cache/vllm": vllm_cache,
    },
)
@modal.concurrent(max_inputs=CONCURRENT_INPUTS)
@modal.web_server(port=PORT, startup_timeout=10 * 60, requires_proxy_auth=True)
def serve():
    """Serve UGround model with vLLM for optimal inference speed"""
    # vLLM in OpenAI-compatible mode, with correct parameters
    cmd = [
        "vllm",
        "serve",
        MODEL_NAME,
        "--served-model-name", SERVED_NAME,
        "--host", "0.0.0.0",
        "--port", str(PORT),
        "--dtype", "float16",
        "--trust-remote-code",
        "--gpu-memory-utilization", "0.92",
        "--max-model-len", "4096",            # safe context for image tokens + output
        "--uvicorn-log-level", "info",
    ]
    print(f"🚀 Launching UGround in {CLOUD} {REGION} ({GPU} GPU):", " ".join(cmd))
    subprocess.Popen(" ".join(cmd), shell=True)

@app.local_entrypoint()
def show_url():
    """Display the deployed service URL"""
    url = serve.web_url
    print("🌐 Modal UGround Service (us-west-2 Oregon):")
    print(f"   URL: {url}")
    print(f"   Region: {CLOUD} {REGION} (Oregon)")
    print(f"   GPU: {GPU}")
    print(f"   Latency from SF: ~10-20ms")
    print(f"   Min containers: {MIN_CONTAINERS} (always warm)")
    print()
    print("📝 Add to your .env file:")
    print(f"   MODAL_ENDPOINT={url}")
    print(f"   MODAL_KEY=your_modal_key")
    print(f"   MODAL_SECRET=your_modal_secret")
    print()
    print("🔧 How to call (OpenAI Chat Completions + image):")
    print("   POST /v1/chat/completions")
    print('   Model: "uground-2b"')
    print("   Temperature: 0 (deterministic)")
    print("   Image: base64 data URL or public URL")
    print("   Returns: (x, y) in [0, 1000) range")
