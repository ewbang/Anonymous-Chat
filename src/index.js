const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');
const config = require('./config');
const { generate } = require('./random-avatar-generator');
const sharp = require('sharp');
const geoip = require('geoip-lite');

const app = express();
const server = http.createServer(app);

// 配置 CORS
app.use(cors({
  origin: true,  // 允许所有来源
  credentials: true
}));

const io = socketIo(server, {
  cors: {
    origin: true,  // 允许所有来源
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['polling', 'websocket']
});

// 创建上传目录
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 创建数据存储目录
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 聊天记录文件路径
const chatHistoryFile = path.join(dataDir, 'chat_history.json');
const fileHistoryFile = path.join(dataDir, 'file_history.json');
const userDataFile = path.join(dataDir, 'user_data.json');

// 加载历史记录
function loadHistory() {
  try {
    const chatHistory = fs.existsSync(chatHistoryFile)
      ? JSON.parse(fs.readFileSync(chatHistoryFile, 'utf8'))
      : [];
    const fileHistory = fs.existsSync(fileHistoryFile)
      ? JSON.parse(fs.readFileSync(fileHistoryFile, 'utf8'))
      : [];
    return { chatHistory, fileHistory };
  } catch (error) {
    console.error('加载历史记录失败:', error);
    return { chatHistory: [], fileHistory: [] };
  }
}

// 保存历史记录
function saveHistory(chatHistory, fileHistory) {
  try {
    fs.writeFileSync(chatHistoryFile, JSON.stringify(chatHistory, null, 2));
    fs.writeFileSync(fileHistoryFile, JSON.stringify(fileHistory, null, 2));
  } catch (error) {
    console.error('保存历史记录失败:', error);
  }
}

// 存储用户数据
const userData = new Map();

// 加载用户数据
function loadUserData() {
  try {
    if (fs.existsSync(userDataFile)) {
      const data = JSON.parse(fs.readFileSync(userDataFile, 'utf8'));
      Object.entries(data).forEach(([clientId, userInfo]) => {
        userData.set(clientId, userInfo);
      });
    }
  } catch (error) {
    console.error('加载用户数据失败:', error);
  }
}

// 保存用户数据
function saveUserData() {
  try {
    const data = Object.fromEntries(userData);
    fs.writeFileSync(userDataFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('保存用户数据失败:', error);
  }
}

// 在服务器启动时加载用户数据
loadUserData();

// 加载历史记录
const { chatHistory, fileHistory } = loadHistory();

// 存储在线用户
const onlineUsers = new Map();

// 存储用户ID和socket.id的映射关系
const userSockets = new Map();

// 获取在线用户列表
function getOnlineUsers() {
  // 使用 Set 来去重
  const uniqueUsers = new Map();
  onlineUsers.forEach((userInfo, socketId) => {
    if (!uniqueUsers.has(userInfo.userId)) {
      uniqueUsers.set(userInfo.userId, userInfo);
    }
  });
  return Array.from(uniqueUsers.values());
}

// 生成随机用户名
function generateUsername() {
  const all_names = [
    "贾宝玉", "林黛玉", "薛宝钗", "王熙凤", "贾母", "贾政", "王夫人",
    "贾探春", "贾迎春", "贾惜春", "贾琏", "尤氏", "贾赦", "邢夫人",
    "贾蓉", "秦可卿", "贾环", "李纨", "史湘云", "妙玉", "晴雯", "袭人",
    "香菱", "紫鹃", "尤二姐", "尤三姐", "贾芸", "赖大", "赖嬷嬷",
    "孙悟空", "唐僧", "猪八戒", "沙悟净", "白龙马", "玉皇大帝",
    "王母娘娘", "太上老君", "二郎神杨戬", "哪吒", "托塔天王李靖",
    "牛魔王", "铁扇公主", "红孩儿", "白骨精", "金角大王", "银角大王",
    "蜘蛛精", "黄眉大王", "狮驼王",
    "刘备", "关羽", "张飞", "诸葛亮", "赵云", "马超", "黄忠", "姜维",
    "庞统", "魏延", "法正", "曹操", "曹丕", "曹叡", "司马懿", "荀彧",
    "郭嘉", "贾诩", "夏侯惇", "夏侯渊", "张郃", "许褚", "典韦", "孙权",
    "孙策", "周瑜", "鲁肃", "吕蒙", "陆逊", "太史慈", "吕布", "貂蝉",
    "董卓", "袁绍", "袁术", "华雄", "华佗", "张辽", "陈宫",
    "宋江", "卢俊义", "吴用", "公孙胜", "林冲", "鲁智深", "武松",
    "李逵", "燕青", "柴进", "花荣", "秦明", "时迁", "李应", "阮小二",
    "阮小五", "阮小七", "宋清", "戴宗", "杨志", "石秀", "扈三娘",
    "高俅", "蔡京", "童贯", "杨戬", "方腊", "田虎", "王庆", "祝家庄"
  ];

  // 获取当前在线用户的名称列表
  const onlineUsernames = Array.from(onlineUsers.values()).map(user => user.username);
  
  // 过滤掉已经被使用的名称
  const availableNames = all_names.filter(name => !onlineUsernames.includes(name));
  
  // 如果没有可用的名称，生成一个带数字的随机名称
  if (availableNames.length === 0) {
    const randomName = all_names[Math.floor(Math.random() * all_names.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    return `${randomName}${randomNum}`;
  }
  
  // 从可用名称中随机选择一个
  return availableNames[Math.floor(Math.random() * availableNames.length)];
}

// 生成用户数据
async function generateUserData(clientId) {
  // 检查是否已有用户数据
  if (userData.has(clientId)) {
    return userData.get(clientId);
  }

  const username = generateUsername();

  try {
    // 确保头像目录存在
    const profileDir = path.join(__dirname, 'public', 'profile');
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    // 使用本地头像生成器生成头像
    const avatarData = await generate();
    const avatarFileName = `${clientId}.png`;
    const avatarPath = path.join(profileDir, avatarFileName);

    // 保存头像文件
    await sharp(avatarData)
      .resize(200, 200) // 调整头像大小
      .toFile(avatarPath);

    const avatarUrl = `/profile/${avatarFileName}`;

    const newUserData = { username, avatarUrl };
    userData.set(clientId, newUserData);
    // 保存用户数据到文件
    saveUserData();
    return newUserData;
  } catch (error) {
    console.error('生成头像失败:', error);
    // 如果头像生成失败，返回默认头像
    const newUserData = {
      username,
      avatarUrl: '/profile/default.png'
    };
    userData.set(clientId, newUserData);
    // 保存用户数据到文件
    saveUserData();
    return newUserData;
  }
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 解码原始文件名
    const decodedName = decodeURIComponent(file.originalname);
    // 保留原始文件名，但添加时间戳以避免重名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + decodedName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB限制
  }
});

// 中间件
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// 文件上传路由
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有文件上传' });
    }

    res.json({
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname
    });
  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({ error: '文件上传失败' });
  }
});

// 添加清空历史记录的路由
app.post('/clear-history', express.json(), (req, res) => {
  const { password } = req.body;

  // 验证密码
  if (!password || password !== config.clearHistoryPassword) {
    return res.status(401).json({ error: '密码错误' });
  }

  try {
    // 清空聊天记录文件
    fs.writeFileSync(chatHistoryFile, JSON.stringify([], null, 2));
    // 清空文件历史记录
    fs.writeFileSync(fileHistoryFile, JSON.stringify([], null, 2));

    // 清空上传文件目录
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`删除文件失败 ${file}:`, err);
        }
      }
    }

    // 清空内存中的历史记录
    chatHistory.length = 0;
    fileHistory.length = 0;

    // 通知所有客户端清空聊天记录
    io.emit('clear_history');

    res.status(200).json({ message: '聊天记录已清空' });
  } catch (error) {
    console.error('清空历史记录失败:', error);
    res.status(500).json({ error: '清空历史记录失败' });
  }
});

// Socket.IO 连接处理
io.on('connection', async (socket) => {
  // 获取客户端IP地址
  const clientIp = socket.handshake.address;
  // 获取地理位置信息
  const geo = geoip.lookup(clientIp);
  const location = geo ? `${geo.country} ${geo.city}` : '未知地区';

  // 获取浏览器信息
  const userAgent = socket.handshake.headers['user-agent'];
  const browserInfo = parseUserAgent(userAgent);

  // 获取客户端ID
  const clientId = socket.handshake.query.clientId;
  if (!clientId) {
    console.error('未提供客户端ID');
    socket.disconnect();
    return;
  }

  // 获取或生成用户数据
  const userData = await generateUserData(clientId);
  const userInfo = {
    userId: clientId,
    username: userData.username,
    avatarUrl: userData.avatarUrl,
    ip: clientIp,
    location: location,
    browser: browserInfo
  };

  // 存储用户映射
  userSockets.set(socket.id, userInfo);
  onlineUsers.set(socket.id, userInfo);

  // 发送用户数据
  socket.emit('user_data', userInfo);

  // 广播用户加入
  socket.broadcast.emit('user_joined', userInfo);

  // 发送在线用户列表
  const onlineUsersList = getOnlineUsers();
  io.emit('user_list', onlineUsersList);

  // 发送聊天历史
  socket.emit('chat_history', chatHistory);
  socket.emit('file_history', fileHistory);

  // 处理新消息
  socket.on('chat_message', (message) => {
    const messageData = {
      id: uuidv4(),
      userId: clientId,
      username: userInfo.username,
      avatarUrl: userInfo.avatarUrl,
      content: message,
      ip: clientIp,
      location: location,
      browser: browserInfo,
      timestamp: new Date().toISOString()
    };

    chatHistory.push(messageData);
    saveHistory(chatHistory, fileHistory);

    io.emit('chat_message', messageData);
  });

  // 处理文件消息
  socket.on('file_message', (fileData) => {
    const messageData = {
      id: uuidv4(),
      userId: clientId,
      username: userInfo.username,
      avatarUrl: userInfo.avatarUrl,
      fileUrl: fileData.url,
      filename: fileData.name,
      fileType: fileData.type || 'application/octet-stream',
      ip: clientIp,
      location: location,
      browser: browserInfo,
      timestamp: new Date().toISOString()
    };

    fileHistory.push(messageData);
    saveHistory(chatHistory, fileHistory);

    io.emit('file_message', messageData);
  });

  // 处理断开连接
  socket.on('disconnect', () => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      userSockets.delete(socket.id);
      onlineUsers.delete(socket.id);
      socket.broadcast.emit('user_left', userInfo);

      // 发送更新后的用户列表
      const onlineUsersList = getOnlineUsers();
      io.emit('user_list', onlineUsersList);
    }
  });
});

// 解析User-Agent字符串
function parseUserAgent(userAgent) {
  const browserInfo = {
    name: '未知浏览器',
    version: '未知版本',
    os: '未知系统'
  };

  try {
    // 检测浏览器
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browserInfo.name = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
      if (match) browserInfo.version = match[1];
    } else if (userAgent.includes('Firefox')) {
      browserInfo.name = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
      if (match) browserInfo.version = match[1];
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browserInfo.name = 'Safari';
      const match = userAgent.match(/Version\/(\d+\.\d+\.\d+)/);
      if (match) browserInfo.version = match[1];
    } else if (userAgent.includes('Edg')) {
      browserInfo.name = 'Edge';
      const match = userAgent.match(/Edg\/(\d+\.\d+\.\d+\.\d+)/);
      if (match) browserInfo.version = match[1];
    }

    // 检测操作系统
    if (userAgent.includes('Windows')) {
      browserInfo.os = 'Windows';
    } else if (userAgent.includes('Mac OS X')) {
      browserInfo.os = 'macOS';
    } else if (userAgent.includes('Linux')) {
      browserInfo.os = 'Linux';
    } else if (userAgent.includes('Android')) {
      browserInfo.os = 'Android';
    } else if (userAgent.includes('iOS')) {
      browserInfo.os = 'iOS';
    }
  } catch (error) {
    console.error('解析User-Agent失败:', error);
  }

  return browserInfo;
}

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
}); 