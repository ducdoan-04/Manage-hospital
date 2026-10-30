[System.Environment]::SetEnvironmentVariable('OLLAMA_MODELS', 'E:\Ollama\models', 'Process')
[System.Environment]::SetEnvironmentVariable('OLLAMA_LLM_LIBRARY', 'vulkan', 'Process')

Write-Host "Starting Ollama with Vulkan and models on E:\Ollama\models..." -ForegroundColor Cyan
& 'E:\Ollama\ollama.exe' serve
