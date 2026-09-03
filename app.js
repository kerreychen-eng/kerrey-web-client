// Requests stay on the official site origin. Vercel rewrites these paths to
// the private service deployments, avoiding cross-site form submission and
// keeping the browser's security boundary simple.
const LICENSE_SERVER_URL = "/api/license";
const API_ENDPOINT = "/api/task";

const storageKeys = {
    browserId: "browser_id",
    licenseToken: "license_key",
    licenseMetadata: "license_metadata",
    savedEmail: "saved_email",
    pendingRequestId: "pending_request_id",
    pendingRequestPayload: "pending_request_payload",
};

function getBrowserId() {
    let browserId = localStorage.getItem(storageKeys.browserId);
    if (!browserId) {
        browserId = crypto.randomUUID();
        localStorage.setItem(storageKeys.browserId, browserId);
    }
    return browserId;
}

function getPendingRequestId(payloadSignature) {
    let requestId = sessionStorage.getItem(storageKeys.pendingRequestId);
    const savedPayload = sessionStorage.getItem(storageKeys.pendingRequestPayload);
    if (!requestId || savedPayload !== payloadSignature) {
        requestId = crypto.randomUUID();
        sessionStorage.setItem(storageKeys.pendingRequestId, requestId);
        sessionStorage.setItem(storageKeys.pendingRequestPayload, payloadSignature);
    }
    return requestId;
}

function clearPendingRequestId() {
    sessionStorage.removeItem(storageKeys.pendingRequestId);
    sessionStorage.removeItem(storageKeys.pendingRequestPayload);
}

async function responseError(response, fallback) {
    try {
        const payload = await response.json();
        return payload.detail || fallback;
    } catch {
        return fallback;
    }
}

function readCachedLicenseMetadata() {
    try {
        const value = localStorage.getItem(storageKeys.licenseMetadata);
        return value ? JSON.parse(value) : null;
    } catch {
        localStorage.removeItem(storageKeys.licenseMetadata);
        return null;
    }
}

function cacheLicenseMetadata(data) {
    if (data?.license_type !== "FULL" && data?.license_type !== "TRIAL") {
        return;
    }
    localStorage.setItem(
        storageKeys.licenseMetadata,
        JSON.stringify({
            license_type: data.license_type,
            remaining_tasks: data.remaining_tasks,
        }),
    );
}

function clearStoredLicense() {
    localStorage.removeItem(storageKeys.licenseToken);
    localStorage.removeItem(storageKeys.licenseMetadata);
}

document.addEventListener("DOMContentLoaded", () => {
    const activationView = document.getElementById("activation-view");
    const appView = document.getElementById("app-view");
    const keyInput = document.getElementById("product-key-input");
    const activateButton = document.getElementById("activate-button");
    const activationStatus = document.getElementById("activation-status");
    const keywordInput = document.getElementById("keyword-input");
    const emailInput = document.getElementById("email-input");
    const levantaEnabledInput = document.getElementById("levanta-enabled");
    const submitButton = document.getElementById("submit-button");
    const appStatus = document.getElementById("app-status");
    const licenseSummary = document.getElementById("license-summary");
    const licenseTypeLabel = document.getElementById("license-type-label");
    const licenseQuotaLabel = document.getElementById("license-quota-label");
    const changeLicenseButton = document.getElementById("change-license-button");
    let quotaExhausted = false;

    function showActivationView(message = "") {
        activationView.style.display = "block";
        appView.style.display = "none";
        activationStatus.textContent = message;
        activationStatus.className = message ? "status error" : "status";
    }

    function showAppView() {
        activationView.style.display = "none";
        appView.style.display = "block";
        const savedEmail = sessionStorage.getItem(storageKeys.savedEmail);
        if (savedEmail) {
            emailInput.value = savedEmail;
        }
    }

    function updateLicenseSummary(data) {
        if (data?.license_type !== "FULL" && data?.license_type !== "TRIAL") {
            return;
        }

        const isTrial = data.license_type === "TRIAL";
        licenseSummary.hidden = false;
        licenseSummary.classList.toggle("trial", isTrial);
        licenseTypeLabel.textContent = isTrial ? "试用名额卡" : "正式卡";
        if (isTrial) {
            const parsedRemaining = Number(data.remaining_tasks);
            const remaining = Number.isFinite(parsedRemaining)
                ? Math.max(parsedRemaining, 0)
                : 0;
            quotaExhausted = remaining === 0;
            licenseQuotaLabel.textContent = `剩余 ${remaining} 次`;
            submitButton.disabled = quotaExhausted;
            if (quotaExhausted) {
                showAppStatus("试用名额已用完，请更换卡密。", true);
            }
        } else {
            quotaExhausted = false;
            licenseQuotaLabel.textContent = "不限次数";
            submitButton.disabled = false;
        }
        cacheLicenseMetadata(data);
    }

    function showLicenseStatusUnavailable(message) {
        const cachedMetadata = readCachedLicenseMetadata();
        if (cachedMetadata) {
            updateLicenseSummary(cachedMetadata);
        } else {
            licenseSummary.hidden = false;
            licenseSummary.classList.remove("trial");
            licenseTypeLabel.textContent = "已激活";
            licenseQuotaLabel.textContent = "状态待同步";
        }
        showAppStatus(message, true);
    }

    function fetchLicenseStatus(licenseToken) {
        return fetch(`${LICENSE_SERVER_URL}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ license_token: licenseToken }),
        });
    }

    async function handleTaskAuthorizationError(message, licenseToken) {
        try {
            const statusResponse = await fetchLicenseStatus(licenseToken);
            if (statusResponse.status === 401) {
                clearStoredLicense();
                clearPendingRequestId();
                showActivationView(
                    await responseError(statusResponse, "授权已失效，请重新激活。"),
                );
                return;
            }
            if (statusResponse.ok) {
                updateLicenseSummary(await statusResponse.json());
            }
        } catch (error) {
            console.error("提交后复核授权失败", error);
        }

        // The task API can also return 401 when its own service credential is
        // unavailable. Keep the user's valid token and allow a later retry.
        showAppStatus(message || "任务服务暂未能确认授权，请稍后重试。", true);
    }

    async function validateStoredLicense() {
        const licenseToken = localStorage.getItem(storageKeys.licenseToken);
        if (!licenseToken) {
            showActivationView();
            return;
        }

        // A saved token is enough to enter the app. Only an explicit 401 from
        // the license service proves it is invalid; rollout gaps and temporary
        // service failures must not be presented as "no ACC".
        showAppView();
        const cachedMetadata = readCachedLicenseMetadata();
        if (cachedMetadata) {
            updateLicenseSummary(cachedMetadata);
        }

        try {
            const response = await fetchLicenseStatus(licenseToken);
            if (!response.ok) {
                if (response.status === 401) {
                    clearStoredLicense();
                    clearPendingRequestId();
                    showActivationView(await responseError(response, "授权已失效，请重新激活。"));
                    return;
                }
                showLicenseStatusUnavailable("授权状态暂时无法同步，仍可提交任务验证。");
                return;
            }
            const data = await response.json();
            updateLicenseSummary(data);
            showAppStatus("", false);
        } catch (error) {
            console.error("校验授权失败", error);
            showLicenseStatusUnavailable("授权状态暂时无法同步，仍可提交任务验证。");
        }
    }

    activateButton.addEventListener("click", async () => {
        const productKey = keyInput.value.trim();
        if (!productKey) {
            showActivationError("卡密不能为空。");
            return;
        }

        setActivationLoading(true, "正在激活，请稍候...");
        try {
            const response = await fetch(`${LICENSE_SERVER_URL}/activate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_key: productKey,
                    machine_id: getBrowserId(),
                }),
            });
            if (!response.ok) {
                showActivationError(await responseError(response, "激活失败，请检查卡密。"));
                return;
            }

            const data = await response.json();
            clearPendingRequestId();
            localStorage.setItem(storageKeys.licenseToken, data.license_key);
            keyInput.value = "";
            setActivationLoading(false, "激活成功。", true);
            showAppView();
            updateLicenseSummary(data);
        } catch (error) {
            console.error("激活网络错误", error);
            showActivationError("激活失败：无法连接到授权服务器。");
        }
    });

    submitButton.addEventListener("click", async () => {
        const keyword = keywordInput.value.trim();
        const email = emailInput.value.trim();
        const licenseToken = localStorage.getItem(storageKeys.licenseToken);
        const levantaEnabled = Boolean(levantaEnabledInput?.checked);
        const maxProducts = 50;
        const providers = levantaEnabled ? ["acc", "levanta"] : ["acc"];

        if (!keyword || !email) {
            showAppStatus("关键词和邮箱不能为空。", true);
            return;
        }
        if (!email.includes("@") || !email.includes(".")) {
            showAppStatus("请输入有效的邮箱格式。", true);
            return;
        }
        if (!licenseToken) {
            showActivationView("请先激活卡密。");
            return;
        }

        setSubmitLoading(true, "正在提交... 首次提交可能耗时约1分钟，请耐心等待。");
        let isSuccess = false;
        try {
            const response = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${licenseToken}`,
                },
                body: JSON.stringify({
                    keyword,
                    email,
                    providers,
                    max_products: maxProducts,
                    request_id: getPendingRequestId(
                        JSON.stringify({ keyword, email, providers, max_products: maxProducts }),
                    ),
                }),
            });

            if (!response.ok) {
                const message = await responseError(response, "提交失败，服务器错误。");
                if (response.status === 401) {
                    await handleTaskAuthorizationError(message, licenseToken);
                } else {
                    if (message.includes("试用名额已用完")) {
                        updateLicenseSummary({
                            license_type: "TRIAL",
                            remaining_tasks: 0,
                        });
                        clearPendingRequestId();
                    }
                    showAppStatus(message, true);
                }
                return;
            }

            const data = await response.json();
            clearPendingRequestId();
            keywordInput.value = "";
            sessionStorage.setItem(storageKeys.savedEmail, email);
            updateLicenseSummary(data);
            const isPendingConfirmation = data.reservation_status === "publishing";
            showAppStatus(
                isPendingConfirmation ? "任务已受理，状态确认中。" : "任务已成功提交。",
                false,
            );
            isSuccess = true;
        } catch (error) {
            console.error("提交任务网络错误", error);
            showAppStatus("提交状态未知，请勿更换关键词，稍后重试。", true);
        } finally {
            setSubmitLoading(false);
            if (isSuccess) {
                setTimeout(() => showAppStatus("", false), 3000);
            }
        }
    });

    changeLicenseButton.addEventListener("click", () => {
        clearStoredLicense();
        clearPendingRequestId();
        showActivationView();
        keyInput.focus();
    });

    function setActivationLoading(isLoading, message = "", isSuccess = false) {
        activateButton.disabled = isLoading;
        activationStatus.textContent = message;
        activationStatus.className = isSuccess ? "status success" : "status";
    }

    function showActivationError(message) {
        activationStatus.textContent = message;
        activationStatus.className = "status error";
        activateButton.disabled = false;
    }

    function setSubmitLoading(isLoading, message = "") {
        submitButton.disabled = isLoading || quotaExhausted;
        if (isLoading) {
            appStatus.textContent = message;
            appStatus.className = "status";
        }
    }

    function showAppStatus(message, isError = false) {
        appStatus.textContent = message;
        appStatus.className = isError ? "status error" : "status success";
    }

    validateStoredLicense();
});
