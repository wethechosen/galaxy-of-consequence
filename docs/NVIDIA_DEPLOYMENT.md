# NVIDIA deployment status

## Active local deployment

The playable application runs locally at `http://127.0.0.1:3101`.

- Live generation: NVIDIA hosted NIM endpoint.
- Model: `nvidia/nemotron-3-super-120b-a12b` (overridable with `NVIDIA_MODEL`).
- Knowledge retrieval: the application-owned SQLite FTS5 sourcebook index.
- Secret handling: `NVIDIA_API_KEY` remains server-side in `.env.local`.
- State authority: game rules, dice, credits, inventory, access, travel, and saves remain deterministic server responsibilities.

Run `npm run nvidia:verify` from the project directory to test the provider and retrieval index without changing campaign state. The command never prints the credential.

## Installed but not activated

The official NVIDIA RAG Blueprint repository is available under `vendor/nvidia-rag`, and its Python library environment is installed under `.venv-nvidia-rag`. Both directories are ignored by version control.

The Blueprint's standard local ingestion stack is not activated on this Windows machine because it expects a Linux/container-oriented NV-Ingest service. The existing application index is therefore the production retrieval path for this deployment.

## Hardware-gated ACE components

The native Game Agent SDK, local Nemotron GGUF inference, speech, and Audio2Face remain disabled until the host has:

- a supported NVIDIA Ampere-or-newer GPU visible to `nvidia-smi`;
- a current NVIDIA driver and CUDA toolkit;
- required native build tools or the supported container runtime;
- fully downloaded model archives (not `.crdownload` partial files).

Do not route game-state mutations through any AI component. Provider failures must leave the saved campaign unchanged and expose a retry action.
