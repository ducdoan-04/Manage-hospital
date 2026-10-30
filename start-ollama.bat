@echo off
title Ollama Hospital AI Server
echo ========================================================
echo   DANG KHOI DONG OLLAMA AI TREN GPU RTX 3050 (VULKAN)
echo   Vi tri luu model: E:\Ollama\models
echo ========================================================

set OLLAMA_MODELS=E:\Ollama\models
set OLLAMA_LLM_LIBRARY=vulkan

"E:\Ollama\ollama.exe" serve
pause
