import { ClaudeCodeSdk } from './sdk';
import type { SDKMessage } from '@anthropic-ai/claude-code';

// 创建 SDK 实例
const sdk = new ClaudeCodeSdk();

// 添加消息监听器
const unsubscribe = sdk.onMessage((msg: SDKMessage) => {
  console.log('收到消息:', msg.type);
  
  switch (msg.type) {
    case 'user':
      console.log('用户消息:', msg.message);
      break;
    case 'assistant':
      console.log('助手回复:', msg.message.content);
      break;
    case 'result':
      console.log('执行结果:', msg.subtype, msg.is_error);
      break;
    case 'system':
      if (msg.subtype === 'init') {
        console.log('会话初始化:', msg.session_id);
      }
      break;
    case 'stream_event':
      // 处理流式事件
      break;
  }
});

// 发送消息
sdk.sendTextMessage('Hello, Claude!');

// 稍后取消监听
// unsubscribe();