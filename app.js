// app.js (v1.1 - 修复了激活反馈的 Bug)

// --- 1. 配置 ---
const LICENSE_SERVER_URL = "https://kerrey-severss.vercel.app/activate";
const API_ENDPOINT = "https://kerrey-api-vercel.vercel.app/submit_task";

// --- 2. 辅助函数：获取唯一的浏览器ID ---
function getBrowserId() {
    let browserId = localStorage.getItem('browser_id');
    if (!browserId) {
        browserId = crypto.randomUUID(); 
        localStorage.setItem('browser_id', browserId);
    }
    return browserId;
}

// --- 3. DOM 元素获取 ---
document.addEventListener('DOMContentLoaded', () => {
    
    const activationView = document.getElementById('activation-view');
    const appView = document.getElementById('app-view');
    const keyInput = document.getElementById('product-key-input');
    const activateButton = document.getElementById('activate-button');
    const activationStatus = document.getElementById('activation-status');
    const keywordInput = document.getElementById('keyword-input');
    const emailInput = document.getElementById('email-input');
    const submitButton = document.getElementById('submit-button');
    const appStatus = document.getElementById('app-status');

    // --- 4. 核心逻辑：检查激活状态 ---
    function checkLicense() {
        const licenseKey = localStorage.getItem('license_key');
        if (licenseKey) {
            activationView.style.display = 'none';
            appView.style.display = 'block';
        } else {
            activationView.style.display = 'block';
            appView.style.display = 'none';
        }
    }

    // --- 5. 激活按钮事件 (已修复) ---
    activateButton.addEventListener('click', async () => {
        const productKey = keyInput.value.trim();
        if (!productKey) {
            showActivationError("密钥不能为空！");
            return;
        }

        setActivationLoading(true, "正在激活，请稍候...");

        try {
            const machineId = getBrowserId(); 
            
            const response = await fetch(LICENSE_SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_key: productKey,
                    machine_id: machineId 
                }),
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('license_key', data.license_key);
                
                // 成功：显示成功信息并禁用按钮
                setActivationLoading(false, "✅ 激活成功！", true);
                
                setTimeout(checkLicense, 1000); // 1秒后切换视图
            } else {
                // 失败：显示服务器返回的错误信息
                const errorData = await response.json();
                showActivationError(errorData.detail || "激活失败，请检查您的密钥。");
            }

        } catch (error) {
            // 失败：显示网络错误
            console.error("激活时发生网络错误:", error);
            showActivationError("激活失败：无法连接到服务器。请检查网络。");
        }
        
        // --- 修复点 ---
        // 我们不再使用 finally, 而是将“停止加载”的逻辑
        // 放入各自的成功/失败分支中。
        // 只有在“加载中”的状态下才重置按钮
        if (activateButton.disabled) {
             // 如果状态不是成功 (isSuccess = true), 就重置按钮
             if (!activationStatus.classList.contains('success')) {
                activateButton.disabled = false;
             }
        }
    });

    // --- 6. 提交任务按钮事件 (已修复) ---
    submitButton.addEventListener('click', async () => {
        const keyword = keywordInput.value.trim();
        const email = emailInput.value.trim();

        if (!keyword || !email) {
            showAppStatus("关键词和邮箱不能为空。", true);
            return;
        }
        if (!email.includes('@') || !email.includes('.')) {
            showAppStatus("请输入有效的邮箱格式。", true);
            return;
        }

        setSubmitLoading(true, "正在提交任务...");
        let isSuccess = false;

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword: keyword,
                    email: email
                }),
            });

            if (response.ok) {
                showAppStatus("✅ 任务已成功提交！", false);
                keywordInput.value = ""; 
                isSuccess = true;
            } else {
                const errorData = await response.json();
                showAppStatus(errorData.detail || "提交失败，服务器错误。", true);
            }

        } catch (error) {
            console.error("提交任务时发生网络错误:", error);
            showAppStatus("提交失败：无法连接到API服务器。", true);
        } finally {
            // 无论成功失败，都重置提交按钮
            setSubmitLoading(false);
            if (isSuccess) {
                 // 成功后延迟清除状态
                setTimeout(() => {
                    showAppStatus("", false);
                }, 3000);
            }
        }
    });

    // --- 7. UI 状态辅助函数 (已修改) ---
    
    function setActivationLoading(isLoading, message = "", isSuccess = false) {
        activateButton.disabled = isLoading;
        activationStatus.textContent = message;
        if (isSuccess) {
            activationStatus.className = 'status success';
        } else {
             activationStatus.className = 'status';
        }
    }
    
    function showActivationError(message) {
        activationStatus.textContent = `❌ ${message}`;
        activationStatus.className = 'status error';
        activateButton.disabled = false; // <-- 修复点：确保按钮在出错时被重新启用
    }

    function setSubmitLoading(isLoading, message = "") {
        submitButton.disabled = isLoading;
        if (isLoading) {
            appStatus.textContent = message;
            appStatus.className = 'status';
        } else {
             // 仅停止加载时，不清除消息
             submitButton.disabled = false;
        }
    }

    function showAppStatus(message, isError = false) {
        appStatus.textContent = message;
        appStatus.className = isError ? 'status error' : 'status success';
    }

    // --- 8. 启动 ---
    checkLicense();
});