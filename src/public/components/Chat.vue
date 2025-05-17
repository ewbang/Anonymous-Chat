<template>
  <div class="chat-container">
    <!-- 侧边栏 -->
    <div class="sidebar" :class="{ active: sidebarActive }">
      <div class="user-info">
        <img :src="getAvatarUrl(userData.avatarUrl)" :alt="userData.username" />
        <h3>{{ userData.username }}</h3>
        <p>{{ userData.location }}</p>
        <p>{{ userData.browser.name }} {{ userData.browser.version }}</p>
      </div>
      <div class="online-users">
        <h3>在线用户 ({{ otherUsers.length }})</h3>
        <ul class="user-list">
          <li v-for="user in otherUsers" :key="user.userId" class="user-item">
            <img :src="getAvatarUrl(user.avatarUrl)" :alt="user.username" />
            <div class="user-details">
              <h4 class="username">{{ user.username }}</h4>
              <p class="user-meta">{{ user.location }}</p>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <div class="chat-header">
        <button class="mobile-menu-btn" @click="sidebarActive = !sidebarActive">
          <i class="fas fa-bars"></i>
        </button>
        <h2>匿名聊天室</h2>
      </div>

      <div class="messages" ref="messagesContainer">
        <div v-for="message in messages" :key="message.id" class="message"
          :class="{ sent: message.userId === userData.userId }">
          <img class="avatar" :src="getAvatarUrl(message.avatarUrl)" :alt="message.username" />
          <div class="message-content">
            <div class="message-header">
              <h4>{{ message.username }}</h4>
            </div>
            <div v-if="message.content" class="message-text" @click="copyMessage(message.content, message.id, $event)">{{ message.content }}</div>
            <div v-if="message.fileUrl" class="file-message">
              <i class="fas fa-file file-icon"></i>
              <div class="file-info">
                <p class="file-name">{{ message.filename }}</p>
              </div>
              <div class="file-actions">
                <button @click="previewFile(message)" v-if="isImage(message.fileType)">
                  <i class="fas fa-eye"></i>
                </button>
                <button @click="downloadFile(message)">
                  <i class="fas fa-download"></i>
                </button>
              </div>
            </div>
            <div class="message-meta">
              <span>{{ formatTime(message.timestamp) }}</span>
              <span>{{ message.location }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="input-area">
        <button class="clear-history-btn" @click="showPasswordDialog" title="清空聊天记录">
          <i class="fas fa-trash-alt"></i>
        </button>
        <input type="file" ref="fileInput" class="file-input" @change="handleFileUpload" accept="*/*" />
        <button class="file-input-label" @click="$refs.fileInput.click()">
          <i class="fas fa-paperclip"></i>
        </button>
        <input type="text" v-model="newMessage" class="message-input" placeholder="输入消息..."
          @keyup.enter="sendMessage" />
        <button class="send-button" @click="sendMessage" :disabled="!newMessage.trim()">
          发送
        </button>
      </div>
    </div>

    <!-- 移动端遮罩层 -->
    <div class="overlay" :class="{ active: sidebarActive }" @click="sidebarActive = false">
    </div>
  </div>
  <!-- 复制成功提示 -->
  <div v-if="showCopyTip" class="copy-tip" :style="{ left: copyTipPosition.x + 'px', top: copyTipPosition.y + 'px' }">
    已复制到剪贴板
  </div>
  <!-- 图片预览模态框 -->
  <div v-if="showImagePreview" class="image-preview-modal" @click="closeImagePreview">
    <div class="image-preview-content" @click.stop>
      <img :src="previewImageUrl" alt="预览图片">
      <button class="close-btn" @click="closeImagePreview">
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>

  <!-- 添加密码输入对话框 -->
  <div v-if="showPasswordModal" class="password-modal" @click.self="closePasswordDialog">
    <div class="password-modal-content">
      <div class="password-modal-header">
        <div class="header-title">
          <i class="fas fa-shield-alt"></i>
          <h3>清空聊天记录</h3>
        </div>
        <button class="close-icon" @click="closePasswordDialog">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="password-modal-body">
        <div class="password-input-wrapper">
          <input type="password" v-model="password" @keyup.enter="confirmClearHistory" placeholder="请输入管理员密码"
            ref="passwordInput" :class="{ 'error': passwordError }">
          <i class="fas fa-lock input-icon"></i>
        </div>
        <div v-if="passwordError" class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          {{ passwordError }}
        </div>
      </div>
      <div class="password-modal-footer">
        <button class="cancel-btn" @click="closePasswordDialog">
          <i class="fas fa-times"></i>
          取消
        </button>
        <button class="confirm-btn" @click="confirmClearHistory" :disabled="!password">
          <i class="fas fa-trash-alt"></i>
          确认清空
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client'
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'

export default {
  name: 'Chat',
  setup() {
    const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000', {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['polling', 'websocket'],
      forceNew: true,
      query: {
        clientId: getClientId()
      }
    })
    const userData = ref({
      userId: '',
      username: '加载中...',
      avatarUrl: '',
      location: '未知',
      browser: {
        name: '未知浏览器',
        version: '',
        os: '未知系统'
      }
    })
    const currentUser = ref(null)
    const currentUserAvatar = ref('')
    const users = ref([])
    const messages = ref([])
    const newMessage = ref('')
    const chatMessages = ref(null)
    const fileInput = ref(null)
    const copiedIndex = ref(null)
    const showCopyTip = ref(false)
    const copyTipPosition = ref({ x: 0, y: 0 })
    const showImagePreview = ref(false)
    const previewImageUrl = ref('')
    const showPasswordModal = ref(false)
    const password = ref('')
    const passwordInput = ref(null)
    const passwordError = ref('')
    const avatarLoaded = ref(false)
    const sidebarActive = ref(false)
    const messagesContainer = ref(null)

    // 计算其他用户列表
    const otherUsers = computed(() => {
      if (!currentUser.value) return []
      return users.value.filter(user => user.userId !== currentUser.value.userId)
    })

    // 生成或获取客户端ID
    function getClientId() {
      let clientId = localStorage.getItem('clientId')
      if (!clientId) {
        clientId = 'client_' + Math.random().toString(36).substr(2, 9)
        localStorage.setItem('clientId', clientId)
      }
      return clientId
    }

    // 监听连接事件
    socket.on('connect', () => {
      console.log('已连接到服务器')
    })

    // 监听连接错误
    socket.on('connect_error', (error) => {
      console.error('连接错误:', error)
    })

    // 监听重连尝试
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('尝试重连 #', attemptNumber)
    })

    // 监听重连成功
    socket.on('reconnect', (attemptNumber) => {
      console.log('重连成功，尝试次数:', attemptNumber)
    })

    // 接收用户数据
    socket.on('user_data', (data) => {
      console.log('收到用户数据:', data)
      userData.value = data
      currentUser.value = data
      // 确保头像 URL 使用完整的服务器地址
      currentUserAvatar.value = data.avatarUrl.startsWith('http')
        ? data.avatarUrl
        : `${import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'}${data.avatarUrl}`
    })

    // 接收用户列表
    socket.on('user_list', (userList) => {
      console.log('收到用户列表:', userList)
      users.value = userList
    })

    // 接收用户加入
    socket.on('user_joined', (userData) => {
      console.log('用户加入:', userData)
      if (!users.value.some(user => user.userId === userData.userId)) {
        users.value.push(userData)
      }
    })

    // 接收用户离开
    socket.on('user_left', (userData) => {
      console.log('用户离开:', userData)
      users.value = users.value.filter(user => user.userId !== userData.userId)
    })

    // 接收聊天历史
    socket.on('chat_history', (history) => {
      console.log('收到聊天历史:', history)
      messages.value = history.map(msg => ({
        type: 'text',
        ...msg,
        browser: msg.browser || { name: '未知浏览器', version: '', os: '未知系统' }
      }))
      scrollToBottom()
    })

    // 接收文件历史
    socket.on('file_history', (history) => {
      console.log('收到文件历史:', history)
      const fileMessages = history.map(file => ({
        type: 'file',
        ...file,
        browser: file.browser || { name: '未知浏览器', version: '', os: '未知系统' }
      }))
      // 合并所有消息并按时间排序
      messages.value = [...messages.value, ...fileMessages].sort((a, b) => {
        return new Date(a.timestamp) - new Date(b.timestamp)
      })
      scrollToBottom()
    })

    // 接收新消息
    socket.on('chat_message', (message) => {
      console.log('收到新消息:', message)
      messages.value.push({
        type: 'text',
        ...message
      })
      scrollToBottom()
    })

    // 接收文件消息
    socket.on('file_message', (fileData) => {
      console.log('收到文件消息:', fileData)
      messages.value.push({
        type: 'file',
        ...fileData
      })
      scrollToBottom()
    })

    // 添加清空历史记录事件监听
    socket.on('clear_history', () => {
      messages.value = []
    })

    // 发送消息
    const sendMessage = () => {
      if (newMessage.value.trim()) {
        console.log('发送消息:', newMessage.value)
        socket.emit('chat_message', newMessage.value.trim())
        newMessage.value = ''
        // 在移动端发送消息后自动关闭侧边栏
        if (window.innerWidth <= 768) {
          sidebarActive.value = false
        }
      }
    }

    // 触发文件上传
    const triggerFileUpload = () => {
      fileInput.value.click()
    }

    // 处理文件上传
    const handleFileUpload = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      if (file.size > 100 * 1024 * 1024) {
        alert('文件大小不能超过100MB')
        return
      }

      const formData = new FormData()
      // 使用 encodeURIComponent 编码文件名
      const encodedName = encodeURIComponent(file.name)
      formData.append('file', new File([file], encodedName, { type: file.type }))

      try {
        const response = await fetch('/upload', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) throw new Error('上传失败')

        const data = await response.json()
        console.log('文件上传成功:', data)
        socket.emit('file_message', {
          url: data.url,
          name: decodeURIComponent(data.name), // 解码返回的文件名
          type: file.type
        })
      } catch (error) {
        console.error('文件上传失败:', error)
        alert('文件上传失败')
      }

      e.target.value = ''
      // 在移动端上传文件后自动关闭侧边栏
      if (window.innerWidth <= 768) {
        sidebarActive.value = false
      }
    }

    // 获取文件图标
    const getFileIcon = (fileType) => {
      if (fileType.startsWith('image/')) return 'fas fa-image'
      if (fileType.startsWith('video/')) return 'fas fa-video'
      if (fileType.startsWith('audio/')) return 'fas fa-music'
      return 'fas fa-file'
    }

    // 格式化时间
    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }

    // 滚动到底部
    const scrollToBottom = async () => {
      await nextTick()
      const container = messagesContainer.value || (chatMessages.value && chatMessages.value.$el) || null
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }

    // 监听消息变化自动滚动
    watch(messages, () => {
      scrollToBottom()
    })

    // 复制消息
    const copyMessage = async (content, index, event) => {
      try {
        await navigator.clipboard.writeText(content)
        copiedIndex.value = index

        // 设置提示框位置
        const rect = event.target.getBoundingClientRect()
        copyTipPosition.value = {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY - 30
        }

        // 显示提示
        showCopyTip.value = true

        // 2秒后重置状态
        setTimeout(() => {
          copiedIndex.value = null
          showCopyTip.value = false
        }, 2000)
      } catch (err) {
        console.error('复制失败:', err)
      }
    }

    // 判断是否为图片文件
    const isImage = (fileType) => {
      return fileType && fileType.startsWith('image/')
    }

    // 预览图片
    const previewImage = (url) => {
      // 确保使用完整的 URL
      const fullUrl = url.startsWith('http')
        ? url
        : `${import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'}${url}`
      previewImageUrl.value = fullUrl
      showImagePreview.value = true
      document.body.style.overflow = 'hidden' // 防止背景滚动
    }

    // 关闭图片预览
    const closeImagePreview = () => {
      showImagePreview.value = false
      document.body.style.overflow = '' // 恢复背景滚动
    }

    // 显示密码输入对话框
    const showPasswordDialog = () => {
      showPasswordModal.value = true;
      password.value = '';
      passwordError.value = '';
      // 在下一个 tick 后聚焦输入框
      nextTick(() => {
        if (passwordInput.value) {
          passwordInput.value.focus();
        }
      });
    };

    // 关闭密码输入对话框
    const closePasswordDialog = () => {
      showPasswordModal.value = false;
      password.value = '';
      passwordError.value = '';
    };

    // 确认清空历史记录
    const confirmClearHistory = async () => {
      if (!password.value) {
        passwordError.value = '请输入密码';
        return;
      }

      try {
        const response = await fetch('/clear-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ password: password.value })
        });

        if (response.ok) {
          // 清空本地消息数组
          messages.value = [];
          // 清空文件输入框
          if (fileInput.value) {
            fileInput.value.value = '';
          }
          // 关闭图片预览（如果打开的话）
          showImagePreview.value = false;
          previewImageUrl.value = '';
          // 关闭密码对话框
          closePasswordDialog();
          // 显示成功提示
          showSuccessMessage('聊天记录已清空');
        } else {
          const error = await response.json();
          passwordError.value = error.error || '密码错误';
        }
      } catch (error) {
        console.error('清空聊天记录失败:', error);
        passwordError.value = '操作失败，请重试';
      }
    };

    // 显示成功提示
    const showSuccessMessage = (message) => {
      const successTip = document.createElement('div');
      successTip.className = 'success-tip';
      successTip.textContent = message;
      document.body.appendChild(successTip);

      // 2秒后移除提示
      setTimeout(() => {
        successTip.classList.add('fade-out');
        setTimeout(() => {
          document.body.removeChild(successTip);
        }, 300);
      }, 2000);
    };

    // 生成用户消息背景色
    const getUserColor = (username) => {
      // 使用用户名生成一个固定的颜色
      const colors = [
        { bg: '#E3F2FD', text: '#1976D2' }, // 浅蓝色
        { bg: '#E8F5E9', text: '#2E7D32' }, // 浅绿色
        { bg: '#FFF3E0', text: '#E65100' }, // 浅橙色
        { bg: '#F3E5F5', text: '#7B1FA2' }, // 浅紫色
        { bg: '#E0F7FA', text: '#00838F' }, // 浅青色
        { bg: '#FCE4EC', text: '#C2185B' }, // 浅粉色
        { bg: '#F1F8E9', text: '#689F38' }, // 浅黄绿色
        { bg: '#E8EAF6', text: '#3949AB' }, // 浅靛蓝色
      ]

      // 使用用户名生成一个固定的索引
      let hash = 0
      for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash)
      }
      const index = Math.abs(hash) % colors.length
      return colors[index]
    }

    // 处理头像 URL
    const getAvatarUrl = (url) => {
      return url.startsWith('http')
        ? url
        : `${import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'}${url}`
    }

    // 处理头像加载错误
    const handleAvatarError = (event) => {
      console.error('头像加载失败:', event.target.src);
      avatarLoaded.value = false;
      // 设置默认头像
      event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMiIgZmlsbD0iI2Y1ZjVmNSIvPjxwYXRoIGQ9Ik0zMiAxNmE4IDggMCAxMDAgMTYgOCA4IDAgMDAwLTE2em0wIDJhNiA2IDAgMTEwIDEyIDYgNiAwIDAxMC0xMnoiIGZpbGw9IiNjY2NjY2MiLz48L3N2Zz4=';
    };

    // 处理头像加载成功
    const handleAvatarLoad = (event) => {
      console.log('头像加载成功:', event.target.src);
      avatarLoaded.value = true;
    };

    // 获取浏览器图标
    const getBrowserIcon = (browserName) => {
      const icons = {
        'Chrome': 'fab fa-chrome',
        'Firefox': 'fab fa-firefox-browser',
        'Safari': 'fab fa-safari',
        'Edge': 'fab fa-edge',
        '未知浏览器': 'fas fa-globe'
      };
      return icons[browserName] || 'fas fa-globe';
    };

    // 预览文件
    const previewFile = (message) => {
      if (isImage(message.fileType)) {
        previewImage(message.fileUrl)
      } else {
        window.open(message.fileUrl, '_blank')
      }
    }

    // 下载文件
    const downloadFile = (message) => {
      const link = document.createElement('a')
      link.href = message.fileUrl
      link.download = message.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }

    // 组件挂载时连接
    onMounted(() => {
      socket.connect()
      scrollToBottom()
    })

    // 组件卸载时断开连接
    onUnmounted(() => {
      socket.off('connect')
      socket.off('connect_error')
      socket.off('reconnect_attempt')
      socket.off('reconnect')
      socket.off('clear_history')
      socket.off('user_data')
      socket.off('user_list')
      socket.off('user_joined')
      socket.off('user_left')
      socket.disconnect()
    })

    return {
      userData,
      currentUser,
      currentUserAvatar,
      otherUsers,
      users,
      messages,
      newMessage,
      chatMessages,
      fileInput,
      copiedIndex,
      showCopyTip,
      copyTipPosition,
      showImagePreview,
      previewImageUrl,
      sendMessage,
      triggerFileUpload,
      handleFileUpload,
      getFileIcon,
      formatTime,
      copyMessage,
      isImage,
      previewImage,
      previewFile,
      downloadFile,
      closeImagePreview,
      showPasswordModal,
      password,
      passwordInput,
      showPasswordDialog,
      closePasswordDialog,
      confirmClearHistory,
      passwordError,
      showSuccessMessage,
      getUserColor,
      handleAvatarError,
      handleAvatarLoad,
      avatarLoaded,
      getBrowserIcon,
      getAvatarUrl,
      sidebarActive,
      messagesContainer,
    }
  }
}
</script>

<style>
@import '../css/index.css';
</style>