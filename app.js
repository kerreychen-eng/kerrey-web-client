// app.js

// --- 1. 配置 ---
// !! 确保这些 URL 和您的后端一致 !!
const LICENSE_SERVER_URL = "https://kerrey-severss.vercel.app/activate";
const API_ENDPOINT = "https://kerrey-api-vercel.vercel.app/submit_task";


// --- 2. 辅助函数：获取唯一的浏览器ID ---
// 这将作为我们的 "machine_id"，它保存在本地存储中
function getBrowserId() {
    let browserId = localStorage.getItem('browser_id');
    if (!browserId) {
        browserId = crypto.randomUUID(); // 生成一个随机的唯一ID
        localStorage.setItem('browser_id', browserId);
    }
    return browserId;
}

// --- 3. DOM 元素获取 ---
// (在网页加载完毕后运行)
document.addEventListener('DOMContentLoaded', () => {
    
    // 视图
    const activationView = document.getElementById('activation-view');
    const appView = document.getElementById('app-view');

    // 激活视图的元素
    const keyInput = document.getElementById('product-key-input');
    const activateButton = document.getElementById('activate-button');
    const activationStatus = document.getElementById('activation-status');

    // 主应用视图的元素
    const keywordInput = document.getElementById('keyword-input');
    const emailInput = document.getElementById('email-input');
    const submitButton = document.getElementById('submit-button');
    const appStatus = document.getElementById('app-status');

    // --- 4. 核心逻辑：检查激活状态 ---
    function checkLicense() {
        const licenseKey = localStorage.getItem('license_key');
        
        if (licenseKey) {
            // 如果许可证存在，显示主应用
            activationView.style.display = 'none';
            appView.style.display = 'block';
            
            // 可以在这里添加JWT解码来检查有效期，但为了简单，我们先假设它有效
            
        } else {
            // 否则，显示激活界面
            activationView.style.display = 'block';
            appView.style.display = 'none';
        }
    }

    // --- 5. 激活按钮事件 ---
    activateButton.addEventListener('click', async () => {
        const productKey = keyInput.value.trim();
        if (!productKey) {
            showActivationError("密钥不能为空！");
            return;
        }

        setActivationLoading(true, "正在激活，请稍候...");

        try {
            const machineId = getBrowserId(); // 使用浏览器指纹
            
            const response = await fetch(LICENSE_SERVER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    product_key: productKey,
                    machine_id: machineId 
                }),
            });

            if (response.ok) {
                const data = await response.json();
                // 激活成功，保存许可证
                localStorage.setItem('license_key', data.license_key);
                setActivationLoading(false, "✅ 激活成功！", true);
                // 1秒后切换到主应用
                setTimeout(checkLicense, 1000);
            } else {
                // 处理 Vercel/FastAPI 返回的错误 (例如 404, 403)
                const errorData = await response.json();
                showActivationError(errorData.detail || "激活失败，请检查您的密钥。");
            }

        } catch (error) {
            // 处理网络错误 (例如防火墙拦截，Vercel 宕机等)
            console.error("激活时发生网络错误:", error);
            showActivationError("激活失败：无法连接到服务器。请检查网络。");
        } finally {
            setActivationLoading(false);
        }
    });

    // --- 6. 提交任务按钮事件 ---
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

        try {
            // 注意：我们复刻了 .exe 的逻辑，提交任务不需要JWT
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    keyword: keyword,
                    email: email
                }),
            });

            if (response.ok) {
                showAppStatus("✅ 任务已成功提交！", false);
                keywordInput.value = ""; // 清空输入框
            } else {
                const errorData = await response.json();
                showAppStatus(errorData.detail || "提交失败，服务器错误。", true);
            }

        } catch (error) {
            console.error("提交任务时发生网络错误:", error);
            showAppStatus("提交失败：无法连接到API服务器。", true);
        } finally {
            setSubmitLoading(false);
        }
    });

    // --- 7. UI 状态辅助函数 ---
    
    function setActivationLoading(isLoading, message = "", isSuccess = false) {
        activateButton.disabled = isLoading;
        activationStatus.textContent = message;
        activationStatus.className = isSuccess ? 'status success' : 'status';
    }
    
    function showActivationError(message) {
        activationStatus.textContent = `❌ ${message}`;
        activationStatus.className = 'status error';
    }

    function setSubmitLoading(isLoading, message = "") {
        submitButton.disabled = isLoading;
        if (isLoading) {
            appStatus.textContent = message;
            appStatus.className = 'status';
        }
    }

    function showAppStatus(message, isError = false) {
        appStatus.textContent = message;
        appStatus.className = isError ? 'status error' : 'status success';
    }

    // --- 8. 启动 ---
    checkLicense();
});