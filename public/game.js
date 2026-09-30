let currentToken = null;
let currentUser = null;
let currentGameId = null;
let currentMultiplier = 1.00;
let checkInterval = null;
let plane = { x: 50, y: 250 };

async function sendOTP() {
  const userId = document.getElementById('userId').value.trim();
  if (!userId) {
    document.getElementById('error-msg').textContent = '❌ Nhập ID Zalo!';
    return;
  }
  document.getElementById('error-msg').textContent = '⏳ Đang gửi OTP...';
  try {
    const res = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('error-msg').textContent = '✅ Đã gửi OTP! Kiểm tra Zalo.';
      document.getElementById('otp-section').style.display = 'block';
      document.getElementById('otpInput').focus();
    } else {
      document.getElementById('error-msg').textContent = '❌ ' + data.message;
    }
  } catch (err) {
    document.getElementById('error-msg').textContent = '❌ Lỗi kết nối!';
  }
}

async function verifyOTP() {
  const userId = document.getElementById('userId').value.trim();
  const otp = document.getElementById('otpInput').value.trim();
  if (!otp || otp.length !== 6) {
    document.getElementById('error-msg').textContent = '❌ Nhập đủ 6 số!';
    return;
  }
  document.getElementById('error-msg').textContent = '⏳ Đang xác nhận...';
  try {
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId, otp: otp })
    });
    const data = await res.json();
    if (data.success) {
      currentToken = data.token;
      currentUser = data.user;
      localStorage.setItem('aviator_token', currentToken);
      showGameScreen();
    } else {
      document.getElementById('error-msg').textContent = '❌ ' + data.message;
    }
  } catch (err) {
    document.getElementById('error-msg').textContent = '❌ Lỗi kết nối!';
  }
}

function showGameScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  document.getElementById('user-name').textContent = '👤 ' + currentUser.name;
  updateBalance(currentUser.balance);
  resizeCanvas();
  drawGameBackground();
}

function updateBalance(balance) {
  document.getElementById('user-balance').textContent = formatMoney(balance);
  currentUser.balance = balance;
}

function formatMoney(amount) {
  return amount.toLocaleString('vi-VN') + ' VNĐ';
}

async function startGame() {
  const amount = parseInt(document.getElementById('bet-amount').value);
  if (!amount || amount < 1000) { alert('❌ Cược tối thiểu 1.000 VNĐ!'); return; }
  if (amount > 50000) { alert('❌ Cược tối đa 50.000 VNĐ!'); return; }
  if (amount > currentUser.balance) { alert('❌ Không đủ tiền!'); return; }
  try {
    const res = await fetch('/api/aviator/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': currentToken },
      body: JSON.stringify({ amount: amount })
    });
    const data = await res.json();
    if (data.success) {
      currentGameId = data.gameId;
      currentMultiplier = 1.00;
      plane = { x: 50, y: 250 };
      updateBalance(data.balance);
      document.getElementById('multiplier-display').textContent = '1.00x';
      document.getElementById('multiplier-display').style.color = '#FFD700';
      document.getElementById('start-btn').style.display = 'none';
      document.getElementById('cashout-btn').style.display = 'block';
      document.getElementById('bet-amount').disabled = true;
      startFlying();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    alert('❌ Lỗi kết nối!');
  }
}

function startFlying() {
  checkInterval = setInterval(async function() {
    try {
      const res = await fetch('/api/aviator/check/' + currentGameId);
      const data = await res.json();
      if (data.success) {
        currentMultiplier = data.multiplier;
        document.getElementById('multiplier-display').textContent = currentMultiplier.toFixed(2) + 'x';
        drawPlane();
        plane.x += 8;
        plane.y -= 5;
        if (plane.x > 500 || plane.y < 50) plane = { x: 50, y: 250 };
        if (data.status === 'crashed') crash();
      }
    } catch (err) {}
  }, 200);
}

function crash() {
  clearInterval(checkInterval);
  document.getElementById('multiplier-display').textContent = '💥 ' + currentMultiplier.toFixed(2) + 'x';
  document.getElementById('multiplier-display').style.color = '#E74C3C';
  addHistory('lose', 'Vỡ ở ' + currentMultiplier.toFixed(2) + 'x');
  setTimeout(function() { resetGameUI(); loadUser(); }, 2000);
}

async function cashout() {
  if (!currentGameId) return;
  clearInterval(checkInterval);
  try {
    const res = await fetch('/api/aviator/cashout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': currentToken },
      body: JSON.stringify({ gameId: currentGameId })
    });
    const data = await res.json();
    if (data.success) {
      addHistory('win', 'Thắng ' + formatMoney(data.winAmount) + ' ở ' + data.multiplier.toFixed(2) + 'x');
      updateBalance(data.balance);
      document.getElementById('multiplier-display').textContent = '✅ ' + data.multiplier.toFixed(2) + 'x';
      document.getElementById('multiplier-display').style.color = '#27AE60';
      setTimeout(resetGameUI, 2000);
    }
  } catch (err) { alert('❌ Lỗi!'); }
}

function resetGameUI() {
  document.getElementById('start-btn').style.display = 'block';
  document.getElementById('cashout-btn').style.display = 'none';
  document.getElementById('bet-amount').disabled = false;
  document.getElementById('multiplier-display').style.color = '#FFD700';
  document.getElementById('multiplier-display').textContent = '1.00x';
  currentGameId = null;
  currentMultiplier = 1.00;
  plane = { x: 50, y: 250 };
  drawGameBackground();
}

function resizeCanvas() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

function drawGameBackground() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#0f0f1e');
  gradient.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = 'rgba(255, 255, 255, ' + Math.random() * 0.5 + ')';
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
  }
}

function drawPlane() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  drawGameBackground();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(50, 250);
  ctx.quadraticCurveTo(plane.x / 2, plane.y, plane.x, plane.y);
  ctx.stroke();
  ctx.font = '40px Arial';
  ctx.fillText('✈️', plane.x - 20, plane.y);
}

function addHistory(type, text) {
  const box = document.getElementById('history-list');
  const item = document.createElement('div');
  item.className = 'history-item ' + type;
  item.textContent = (type === 'win' ? '🟢 ' : '🔴 ') + text;
  box.insertBefore(item, box.firstChild);
  while (box.children.length > 10) box.removeChild(box.lastChild);
}

async function loadUser() {
  try {
    const res = await fetch('/api/user-me', { headers: { 'Authorization': currentToken } });
    const data = await res.json();
    if (data.success) updateBalance(data.user.balance);
  } catch (err) {}
}

function logout() {
  localStorage.removeItem('aviator_token');
  currentToken = null;
  currentUser = null;
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('game-screen').style.display = 'none';
}

window.addEventListener('load', async function() {
  const savedToken = localStorage.getItem('aviator_token');
  if (savedToken) {
    currentToken = savedToken;
    try {
      const res = await fetch('/api/user-me', { headers: { 'Authorization': currentToken } });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        showGameScreen();
      } else {
        localStorage.removeItem('aviator_token');
      }
    } catch (err) {}
  }
});
