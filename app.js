// app.js (v1.2 - 修复了激活反馈 + 保存邮箱功能)

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
            
            // --- *** 新增代码 *** ---
            // 加载时，自动填充上次保存的邮箱
            const savedEmail = localStorage.getItem('saved_email');
            if (savedEmail) {
                emailInput.value = savedEmail;
            }
            // --- *** 新增结束 *** ---
            
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
                setActivationLoading(false, "✅ 激活成功！", true);
                setTimeout(checkLicense, 1000); 
            } else {
                const errorData = await response.json();
                showActivationError(errorData.detail || "激活失败，请检查您的密钥。");
            }

        } catch (error) {
            console.error("激活时发生网络错误:", error);
            showActivationError("激活失败：无法连接到服务器。请检查网络。");
        }
        
        if (activateButton.disabled) {
             if (!activationStatus.classList.contains('success')) {
                activateButton.disabled = false;
             }
        }
    });

    // --- 6. 提交任务按钮事件 (已修改) ---
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
                
                // --- *** 新增代码 *** ---
                // 提交成功后，保存邮箱
                localStorage.setItem('saved_email', email);
                // --- *** 新增结束 *** ---
                
            } else {
                const errorData = await response.json();
                showAppStatus(errorData.detail || "提交失败，服务器错误。", true);
            }

        } catch (error) {
            console.error("提交任务时发生网络错误:", error);
            showAppStatus("提交失败：无法连接到API服务器。", true);
        } finally {
            setSubmitLoading(false);
            if (isSuccess) {
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
        activateButton.disabled = false;
    }

    function setSubmitLoading(isLoading, message = "") {
        submitButton.disabled = isLoading;
        if (isLoading) {
            appStatus.textContent = message;
            appStatus.className = 'status';
        } else {
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