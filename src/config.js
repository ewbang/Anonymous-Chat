module.exports = {
  // 清空聊天记录的密码
  clearHistoryPassword: 'admin123',
  
  // 其他配置项
  server: {
    port: 3000,
    cors: {
      origin: "http://localhost:5173",
      credentials: true
    }
  }
}; 