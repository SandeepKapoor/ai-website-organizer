const disconnectedView = document.getElementById("disconnected-view");
const connectedView = document.getElementById("connected-view");
const statusText = document.getElementById("status-text");

function send(message) {
  return chrome.runtime.sendMessage(message);
}

async function render() {
  const status = await send({ type: "GET_STATUS" });
  if (status.ok && status.profileId) {
    disconnectedView.style.display = "none";
    connectedView.style.display = "block";
    statusText.textContent = `Connected as "${status.profileName}"`;
  } else {
    disconnectedView.style.display = "block";
    connectedView.style.display = "none";
  }
}

document.getElementById("connect-btn").addEventListener("click", async () => {
  const profileName = document.getElementById("profile-name").value.trim() || "Personal";
  const btn = document.getElementById("connect-btn");
  btn.disabled = true;
  btn.textContent = "Connecting...";
  const result = await send({ type: "CONNECT_PROFILE", profileName });
  btn.disabled = false;
  btn.textContent = "Connect this profile";
  if (!result.ok) {
    alert(`Could not connect: ${result.error}\n\nMake sure the web app is running at http://localhost:3000`);
    return;
  }
  render();
});

document.getElementById("reimport-btn").addEventListener("click", async () => {
  await send({ type: "REIMPORT" });
  window.close();
});

document.getElementById("disconnect-btn").addEventListener("click", async () => {
  await send({ type: "DISCONNECT" });
  render();
});

render();
