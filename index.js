const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const MONGODB_URI = process.env.MONGODB_URI;
const BASE_URL = `https://bot-api.zaloplatforms.com/bot${BOT_TOKEN}`;

const DEV = 'Dev by Dương Quốc Bảo';
const START_BALANCE = 0;
const MIN_BET = 1000;
const MAX_BET = 50000;

const authTokens = {};
const aviatorGames = {};
const otpCodes = {};

function getCrashPoint() {
  const random = Math.random() * 0.9;
  let crashPoint = 1 / (1 - random);
  crashPoint = Math.floor(crashPoint * 100) / 100;
  if (crashPoint < 1.00) crashPoint = 1.00;
  if (crashPoint > 6.00) crashPoint = 6.00;
  return crashPoint;
}

mongoose.connect(MONGODB_URI)
  .then(function() { console.log('✅ Đã kết nối MongoDB'); })
  .catch(function(err) { console.error('❌ Lỗi MongoDB:', err.message); });

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  name: String,
  password: { type: String, default: null },
  balance: { type: Number, default: START_BALANCE },
  winCount: { type: Number, default: 0 },
  loseCount: { type: Number, default: 0 },
  totalBet: { type: Number, default: 0 },
  createdAt: { type: Number, default: Date.now }
});
const User = mongoose.model('User', userSchema);

async function sendZaloMessage(chatId, text) {
  try {
    await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: chatId,
      text: text
    });
  } catch (err) {}
}

// ===== API: KIỂM TRA USER =====
app.post('/api/check-user', async function(req, res) {
  try {
    const { userId } = req.body;
    if (!userId) return res.json({ success: false, message: 'Thiếu ID Zalo' });

    const user = await User.findOne({ userId: userId });
    if (!user) {
      return res.json({ success: false, message: 'ID Zalo không tồn tại. Chat với bot Zalo trước!' });
    }

    res.json({
      success: true,
      hasPassword: !!user.password,
      name: user.name
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== API: TẠO MẬT KHẨU =====
app.post('/api/create-password', async function(req, res) {
  try {
    const { userId, password, password2 } = req.body;

    if (!userId || !password || !password2) {
      return res.json({ success: false, message: 'Thiếu thông tin' });
    }

    if (password !== password2) {
      return res.json({ success: false, message: 'Mật khẩu nhập lại không khớp!' });
    }

    // Kiểm tra mật khẩu: có chữ HOA + số
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpper || !hasNumber) {
      return res.json({ success: false, message: 'Mật khẩu phải có ít nhất 1 chữ IN HOA và 1 chữ số!' });
    }

    if (password.length < 6) {
      return res.json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự!' });
    }

    const user = await User.findOne({ userId: userId });
    if (!user) return res.json({ success: false, message: 'User không tồn tại' });
    if (user.password) return res.json({ success: false, message: 'Bạn đã có mật khẩu rồi!' });

    // Hash mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    // Tạo token
    const token = 'tk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    authTokens[token] = { userId: userId, expires: Date.now() + 24 * 60 * 60 * 1000 };

    res.json({
      success: true,
      token: token,
      user: {
        userId: user.userId,
        name: user.name,
        balance: user.balance
      }
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== API: ĐĂNG NHẬP =====
app.post('/api/login', async function(req, res) {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.json({ success: false, message: 'Thiếu thông tin' });
    }

    const user = await User.findOne({ userId: userId });
    if (!user) return res.json({ success: false, message: 'ID Zalo không tồn tại' });
    if (!user.password) return res.json({ success: false, message: 'Bạn chưa tạo mật khẩu. Vui lòng tạo mật khẩu!' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: 'Sai mật khẩu!' });

    const token = 'tk_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    authTokens[token] = { userId: userId, expires: Date.now() + 24 * 60 * 60 * 1000 };

    res.json({
      success: true,
      token: token,
      user: {
        userId: user.userId,
        name: user.name,
        balance: user.balance
      }
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== API: QUÊN MẬT KHẨU (GỬI OTP) =====
app.post('/api/forgot-password', async function(req, res) {
  try {
    const { userId } = req.body;
    if (!userId) return res.json({ success: false, message: 'Thiếu ID Zalo' });

    const user = await User.findOne({ userId: userId });
    if (!user) return res.json({ success: false, message: 'ID Zalo không tồn tại' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpCodes[userId] = { code: otp, expires: Date.now() + 5 * 60 * 1000 };

    await sendZaloMessage(userId,
      '🔐 MÃ OTP ĐỔI MẬT KHẨU\n' +
      '━━━━━━━━━━━━━━━━━━\n' +
      'Mã OTP của bạn là:\n\n' +
      '🔑 ' + otp + '\n\n' +
      '⏰ Hiệu lực: 5 phút\n' +
      '⚠️ KHÔNG chia sẻ mã này!\n' +
      '━━━━━━━━━━━━━━━━━━\n' +
      DEV);

    res.json({ success: true, message: 'Đã gửi OTP qua Zalo!' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== API: ĐỔI MẬT KHẨU =====
app.post('/api/reset-password', async function(req, res) {
  try {
    const { userId, otp, newPassword, newPassword2 } = req.body;

    if (!userId || !otp || !newPassword || !newPassword2) {
      return res.json({ success: false, message: 'Thiếu thông tin' });
    }

    if (newPassword !== newPassword2) {
      return res.json({ success: false, message: 'Mật khẩu nhập lại không khớp!' });
    }

    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUpper || !hasNumber) {
      return res.json({ success: false, message: 'Mật khẩu phải có chữ IN HOA và chữ số!' });
    }

    if (newPassword.length < 6) {
      return res.json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự!' });
    }

    const saved = otpCodes[userId];
    if (!saved) return res.json({ success: false, message: 'Chưa gửi OTP' });
    if (Date.now() > saved.expires) {
      delete otpCodes[userId];
      return res.json({ success: false, message: 'OTP hết hạn' });
    }
    if (saved.code !== otp) return res.json({ success: false, message: 'OTP sai!' });

    const user = await User.findOne({ userId: userId });
    if (!user) return res.json({ success: false, message: 'User không tồn tại' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    delete otpCodes[userId];

    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== API: LẤY USER =====
app.get('/api/user-me', async function(req, res) {
  try {
    const token = req.headers['authorization'];
    if (!token) return res.json({ success: false, message: 'Chưa đăng nhập' });

    const auth = authTokens[token];
    if (!auth) return res.json({ success: false, message: 'Token sai' });
    if (Date.now() > auth.expires) {
      delete authTokens[token];
      return res.json({ success: false, message: 'Token hết hạn' });
    }

    const user = await User.findOne({ userId: auth.userId });
    if (!user) return res.json({ success: false });

    res.json({
      success: true,
      user: {
        userId: user.userId,
        name: user.name,
        balance: user.balance,
        winCount: user.winCount,
        loseCount: user.loseCount
      }
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== API: AVIATOR START =====
app.post('/api/aviator/start', async function(req, res) {
  try {
    const token = req.headers['authorization'];
    if (!token) return res.json({ success: false, message: 'Chưa đăng nhập' });

    const auth = authTokens[token];
    if (!auth) return res.json({ success: false, message: 'Token sai' });

    const user = await User.findOne({ userId: auth.userId });
    if (!user) return res.json({ success: false });

    const { amount } = req.body;

    if (amount < MIN_BET) return res.json({ success: false, message: 'Cược tối thiểu ' + MIN_BET });
    if (amount > MAX_BET) return res.json({ success: false, message: 'Cược tối đa ' + MAX_BET });
    if (user.balance < amount) return res.json({ success: false, message: 'Không đủ tiền' });

    user.balance -= amount;
    user.totalBet += amount;
    await user.save();

    const gameId = 'av_' + Date.now() + '_' + auth.userId;
    aviatorGames[gameId] = {
      userId: auth.userId,
      betAmount: amount,
      multiplier: 1.00,
      status: 'flying',
      crashed: false,
      cashed: false,
      crashAt: getCrashPoint(),
      startTime: Date.now()
    };

    res.json({
      success: true,
      gameId: gameId,
      multiplier: 1.00,
      balance: user.balance
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== API: AVIATOR CHECK =====
app.get('/api/aviator/check/:gameId', function(req, res) {
  const game = aviatorGames[req.params.gameId];
  if (!game) return res.json({ success: false, message: 'Game không tồn tại' });

  if (!game.crashed) {
    game.multiplier += 0.01;
    game.multiplier = Math.round(game.multiplier * 100) / 100;

    if (game.multiplier >= game.crashAt) {
      game.multiplier = game.crashAt;
      game.crashed = true;
      game.status = 'crashed';
    }
  }

  res.json({
    success: true,
    status: game.status,
    multiplier: game.multiplier,
    crashed: game.crashed,
    cashed: game.cashed,
    crashAt: game.crashed ? game.crashAt : null
  });
});

// ===== API: AVIATOR CASHOUT =====
app.post('/api/aviator/cashout', async function(req, res) {
  try {
    const token = req.headers['authorization'];
    if (!token) return res.json({ success: false, message: 'Chưa đăng nhập' });

    const auth = authTokens[token];
    if (!auth) return res.json({ success: false, message: 'Token sai' });

    const { gameId } = req.body;
    const game = aviatorGames[gameId];
    if (!game) return res.json({ success: false, message: 'Game không tồn tại' });
    if (game.userId !== auth.userId) return res.json({ success: false, message: 'Không phải game của bạn' });
    if (game.cashed) return res.json({ success: false, message: 'Bạn đã lấy tiền rồi!' });
    if (game.crashed) return res.json({ success: false, message: 'Máy bay đã vỡ!' });

    game.cashed = true;
    const cashoutMultiplier = game.multiplier;
    const winAmount = Math.floor(game.betAmount * cashoutMultiplier);

    const user = await User.findOne({ userId: auth.userId });
    user.balance += winAmount;
    user.winCount++;
    await user.save();

    res.json({
      success: true,
      cashoutMultiplier: cashoutMultiplier,
      winAmount: winAmount,
      balance: user.balance
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== HEALTH =====
app.get('/api/health', function(req, res) {
  res.json({ ok: true, dev: DEV });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('🛫 Aviator Web chạy cổng ' + PORT);
  console.log(DEV);
});
