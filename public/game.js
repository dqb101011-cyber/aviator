let currentToken = null;
let currentUser = null;
let currentGameId = null;
let currentMultiplier = 1.00;
let cashoutMultiplier = null;
let checkInterval = null;
let plane = { x: 50, y: 250, trail: [] };
let particles = [];
let animationFrame = null;

// ===== ẢNH MÁY BAY =====
const planeImg = new Image();
planeImg.crossOrigin = 'anonymous';
planeImg.src = 'https://i.ibb.co/jZ8Ch8TD/Picsart-26-10-01-04-36-48-089.png';

// ===== GỬI OTP =====
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

// ===== XÁC NHẬN OTP =====
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
  startAnimationLoop();
}

function updateBalance(balance) {
  document.getElementById('user-balance').textContent = formatMoney(balance);
  currentUser.balance = balance;
}

function formatMoney(amount) {
  return amount.toLocaleString('vi-VN') + ' VNĐ';
}

// ===== BẮT ĐẦU GAME =====
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
      cashoutMultiplier = null;
      plane = { x: 50, y: 250, trail: [] };
      particles = [];
      updateBalance(data.balance);

      document.getElementById('multiplier-display').textContent = '1.00x';
      document.getElementById('multiplier-display').style.color = '#ffffff';
      document.getElementById('status-display').textContent = '';
      document.getElementById('start-btn').style.display = 'none';
      document.getElementById('cashout-btn').style.display = 'block';
      document.getElementById('cashout-btn').disabled = false;
      document.getElementById('bet-amount').disabled = true;

      startFlying();
    } else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    alert('❌ Lỗi kết nối!');
  }
}

// ===== MÁY BAY BAY =====
function startFlying() {
  checkInterval = setInterval(async function() {
    try {
      const res = await fetch('/api/aviator/check/' + currentGameId);
      const data = await res.json();
      if (data.success) {
        currentMultiplier = data.multiplier;
        const display = document.getElementById('multiplier-display');
        display.textContent = currentMultiplier.toFixed(2) + 'x';

        // Đổi màu theo hệ số (giống Spribe)
        if (currentMultiplier < 2) display.style.color = '#ffffff';
        else if (currentMultiplier < 5) display.style.color = '#ffcc00';
        else if (currentMultiplier < 10) display.style.color = '#ff6600';
        else display.style.color = '#cc00ff';

        if (data.crashed) crash();
      }
    } catch (err) {}
  }, 100);
}

// ===== CRASH =====
function crash() {
  clearInterval(checkInterval);

  // Hiệu ứng nổ
  createExplosion(plane.x, plane.y);

  document.getElementById('multiplier-display').textContent = '💥 ' + currentMultiplier.toFixed(2) + 'x';
  document.getElementById('multiplier-display').style.color = '#ff0000';

  if (cashoutMultiplier) {
    document.getElementById('status-display').innerHTML =
      '✅ Bạn đã ăn ở ' + cashoutMultiplier.toFixed(2) + 'x<br>' +
      '💥 Máy bay vỡ ở ' + currentMultiplier.toFixed(2) + 'x';
    document.getElementById('status-display').style.color = '#00ff00';
    addHistory('win', 'Ăn ' + cashoutMultiplier.toFixed(2) + 'x — Vỡ ' + currentMultiplier.toFixed(2) + 'x');
  } else {
    document.getElementById('status-display').innerHTML =
      '💥 Máy bay vỡ ở ' + currentMultiplier.toFixed(2) + 'x<br>' +
      '😢 Bạn đã thua!';
    document.getElementById('status-display').style.color = '#ff0000';
    addHistory('lose', 'Vỡ ở ' + currentMultiplier.toFixed(2) + 'x');
  }

  document.getElementById('cashout-btn').style.display = 'none';

  setTimeout(function() {
    resetGameUI();
    loadUser();
  }, 3000);
}

// ===== CASHOUT =====
async function cashout() {
  if (!currentGameId) return;

  try {
    const res = await fetch('/api/aviator/cashout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': currentToken },
      body: JSON.stringify({ gameId: currentGameId })
    });
    const data = await res.json();
    if (data.success) {
      cashoutMultiplier = data.cashoutMultiplier;
      updateBalance(data.balance);

      // Hiệu ứng pháo hoa
      createFireworks(plane.x, plane.y);

      document.getElementById('status-display').innerHTML =
        '✅ Đã lấy tiền ở ' + cashoutMultiplier.toFixed(2) + 'x<br>' +
        '💰 Nhận: ' + formatMoney(data.winAmount) + '<br>' +
        '⏳ Máy bay vẫn đang bay...';
      document.getElementById('status-display').style.color = '#00ff00';

      document.getElementById('cashout-btn').style.display = 'none';
    } else {
      alert('❌ ' + data.message);
    }
  } catch (err) {
    alert('❌ Lỗi!');
  }
}

// ===== RESET UI =====
function resetGameUI() {
  document.getElementById('start-btn').style.display = 'block';
  document.getElementById('cashout-btn').style.display = 'none';
  document.getElementById('bet-amount').disabled = false;
  document.getElementById('multiplier-display').style.color = '#ffffff';
  document.getElementById('multiplier-display').textContent = '1.00x';
  document.getElementById('status-display').textContent = '';
  currentGameId = null;
  currentMultiplier = 1.00;
  cashoutMultiplier = null;
  plane = { x: 50, y: 250, trail: [] };
  particles = [];
}

function resizeCanvas() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

// ===== VÒNG LẶP ANIMATION =====
function startAnimationLoop() {
  function loop() {
    drawGame();
    updateParticles();
    animationFrame = requestAnimationFrame(loop);
  }
  loop();
}

function drawGame() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Nền (giống Spribe)
  const gradient = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 0,
    canvas.width / 2, canvas.height / 2, canvas.width
  );
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Sao
  for (let i = 0; i < 80; i++) {
    const x = (i * 137) % canvas.width;
    const y = (i * 251) % canvas.height;
    const size = (i % 3) + 1;
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.2 + (i % 5) * 0.1) + ')';
    ctx.fillRect(x, y, size, size);
  }

  // Vẽ máy bay nếu đang bay
  if (currentGameId && !document.getElementById('cashout-btn').disabled) {
    // Trail (vệt bay)
    plane.trail.push({ x: plane.x, y: plane.y, alpha: 1.0 });
    if (plane.trail.length > 40) plane.trail.shift();

    // Vẽ trail (gradient)
    for (let i = 0; i < plane.trail.length; i++) {
      const t = plane.trail[i];
      const alpha = i / plane.trail.length;
      ctx.fillStyle = 'rgba(255, 0, 102, ' + (alpha * 0.5) + ')';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3 + alpha * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vẽ đường bay
    ctx.strokeStyle = 'rgba(255, 0, 102, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, canvas.height - 50);
    ctx.quadraticCurveTo(plane.x / 2, plane.y, plane.x, plane.y);
    ctx.stroke();

    // Vẽ máy bay (ảnh)
    if (planeImg.complete && planeImg.naturalWidth > 0) {
      ctx.save();
      ctx.translate(plane.x, plane.y);
      
      // Rung nhẹ
      const shake = Math.sin(Date.now() / 50) * 2;
      ctx.translate(shake, 0);
      
      ctx.drawImage(planeImg, -30, -30, 60, 60);
      ctx.restore();
    } else {
      // Fallback emoji
      ctx.font = '40px Arial';
      ctx.fillText('✈️', plane.x - 20, plane.y);
    }

    // Di chuyển máy bay
    plane.x += 1.5;
    plane.y -= 0.8;

    if (plane.x > canvas.width - 50 || plane.y < 50) {
      plane.x = 50;
      plane.y = canvas.height - 50;
      plane.trail = [];
    }
  }
}

// ===== HIỆU ỨNG PHÁO HOA =====
function createFireworks(x, y) {
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1.0,
      color: ['#FFD700', '#FF6347', '#FF1493', '#00FF00', '#00FFFF'][Math.floor(Math.random() * 5)]
    });
  }
}

// ===== HIỆU ỨNG NỔ =====
function createExplosion(x, y) {
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 15,
      life: 1.0,
      color: ['#FF0000', '#FF4500', '#FFA500'][Math.floor(Math.random() * 3)]
    });
  }
}

// ===== UPDATE PARTICLES =====
function updateParticles() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2;
    p.life -= 0.02;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ===== LỊCH SỬ =====
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
  if (animationFrame) cancelAnimationFrame(animationFrame);
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
