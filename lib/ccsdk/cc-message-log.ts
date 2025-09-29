import { SDKMessage } from "@anthropic-ai/claude-code";

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

function formatTimestamp(): string {
  return new Date().toISOString().substring(11, 23);
}

function formatHeader(type: string, subtype?: string): string {
  const timestamp = formatTimestamp();
  const header = subtype ? `${type}:${subtype}` : type;
  return `${COLORS.gray}[${timestamp}]${COLORS.reset} ${COLORS.bright}${COLORS.cyan}[${header.toUpperCase()}]${COLORS.reset}`;
}

function formatContent(content: any, indent: number = 2): string {
  const prefix = ' '.repeat(indent);
  if (typeof content === 'string') {
    return content.split('\n').map(line => prefix + line).join('\n');
  }
  if (typeof content === 'object') {
    return prefix + JSON.stringify(content, null, 2).split('\n').join('\n' + prefix);
  }
  return prefix + String(content);
}

export function logMessage(msg: SDKMessage) {
  switch (msg.type) {
    case "user": {
      console.log(formatHeader('user'));

      if (Array.isArray(msg.message.content)) {
        for (const content of msg.message.content) {
          switch (content.type) {
            case "text":
              console.log(`${COLORS.green}  📝 Text:${COLORS.reset}`);
              console.log(formatContent(content.text));
              break;
            case "image":
              console.log(`${COLORS.blue}  🖼️  Image:${COLORS.reset}`, content.source);
              break;
            case "document":
              console.log(`${COLORS.blue}  📄 Document:${COLORS.reset}`);
              console.log(formatContent(content));
              break;
            case "tool_use":
              console.log(`${COLORS.yellow}  🔧 Tool Use:${COLORS.reset} ${content.name}`);
              console.log(formatContent(content.input));
              break;
            case "tool_result":
              console.log(`${COLORS.yellow}  ✅ Tool Result:${COLORS.reset}`);
              console.log(formatContent(content.content));
              if (content.is_error) {
                console.log(` ${COLORS.red} use tool failed`);
              }
              break;
            case "thinking":
            case "redacted_thinking":
              console.log(`${COLORS.magenta}  💭 Thinking:${COLORS.reset}`);
              console.log(formatContent(content.type === 'redacted_thinking' ? content.data : content));
              break;
            default:
              console.log(`${COLORS.gray}  ${content.type}:${COLORS.reset}`);
              console.log(formatContent(content));
          }
        }
      } else if (typeof msg.message.content === 'string') {
        console.log(formatContent(msg.message.content));
      }
      break;
    }

    case "assistant": {
      console.log(formatHeader('assistant'));

      for (const content of msg.message.content) {
        switch (content.type) {
          case "text":
            console.log(`${COLORS.blue}  💬 Response:${COLORS.reset}`);
            console.log(formatContent(content.text));
            break;
          case "thinking":
            console.log(`${COLORS.magenta}  🤔 Thinking:${COLORS.reset}`);
            console.log(formatContent(content.thinking));
            break;
          case "tool_use":
            console.log(`${COLORS.yellow}  🔨 Calling Tool:${COLORS.reset} ${content.name}`);
            console.log(formatContent(content.input));
            break;
          case "mcp_tool_use":
            console.log(`${COLORS.yellow}  🔌 MCP Tool:${COLORS.reset} ${content.server_name}::${content.name}`);
            console.log(formatContent(content.input));
            break;
          case "mcp_tool_result":
            const status = content.is_error ? `${COLORS.red}❌ Error` : `${COLORS.green}✅ Success`;
            console.log(`${COLORS.yellow}  🔌 MCP Result:${COLORS.reset} ${status}${COLORS.reset}`);
            console.log(formatContent(content.content));
            break;
          default:
            if (content.type.includes('tool_result')) {
              console.log(`${COLORS.yellow}  📊 ${content.type}:${COLORS.reset}`);
              console.log(formatContent('content' in content ? content.content : content));
            } else {
              console.log(`${COLORS.gray}  ${content.type}:${COLORS.reset}`);
              console.log(formatContent(content));
            }
        }
      }
      break;
    }

    case "result": {
      const statusColor = msg.is_error ? COLORS.red : COLORS.green;
      const statusIcon = msg.is_error ? '❌' : '✅';

      console.log(formatHeader('result', msg.subtype));
      console.log(`${statusColor}  ${statusIcon} Status: ${msg.subtype}${COLORS.reset}`);

      if (msg.subtype === 'success' && 'result' in msg) {
        console.log(`${COLORS.green}  📋 Result:${COLORS.reset}`);
        console.log(formatContent(msg.result));
      }

      if (msg.subtype === 'error_max_turns') {
        console.log(`${COLORS.red}  ⚠️  Max turns reached: ${msg.num_turns}${COLORS.reset}`);
      }

      console.log(`${COLORS.gray}  ⏱️  Duration: ${msg.duration_ms}ms (API: ${msg.duration_api_ms}ms)${COLORS.reset}`);
      console.log(`${COLORS.gray}  💰 Cost: $${msg.total_cost_usd.toFixed(4)}${COLORS.reset}`);

      if ('usage' in msg && msg.usage) {
        console.log(`${COLORS.gray}  📊 Tokens - Input: ${msg.usage.input_tokens}, Output: ${msg.usage.output_tokens}${COLORS.reset}`);
      }
      break;
    }

    case "system": {
      if (msg.subtype === 'init') {
        console.log(formatHeader('system', 'init'));
        console.log(`${COLORS.green}  🚀 Session initialized${COLORS.reset}`);
        console.log(`${COLORS.green}    • Model: ${msg.model}${COLORS.reset}`);
        console.log(`${COLORS.green}    • Working Dir: ${msg.cwd}${COLORS.reset}`);
        console.log(`${COLORS.green}    • Permission Mode: ${msg.permissionMode}${COLORS.reset}`);
        console.log(`${COLORS.green}    • Available Tools: ${msg.tools.length} tools${COLORS.reset}`);
        if (msg.mcp_servers && msg.mcp_servers.length > 0) {
          console.log(`${COLORS.green}    • MCP Servers: ${msg.mcp_servers.map(s => `${s.name}(${s.status})`).join(', ')}${COLORS.reset}`);
        }
      } else if (msg.subtype === 'compact_boundary') {
        console.log(formatHeader('system', 'compact'));
        console.log(`${COLORS.yellow}  📦 Conversation compacted${COLORS.reset}`);
        console.log(`${COLORS.yellow}    • Trigger: ${msg.compact_metadata.trigger}${COLORS.reset}`);
        console.log(`${COLORS.yellow}    • Pre-tokens: ${msg.compact_metadata.pre_tokens}${COLORS.reset}`);
      } else {
        console.log(formatHeader('system'));
        console.log(formatContent(msg));
      }
      break;
    }

    case "stream_event": {
      // 流式事件通常很多，使用更简洁的日志
      if (msg.event.type === 'content_block_delta') {
        // 只显示文本内容的增量，避免刷屏
        if ('delta' in msg.event && 'text' in msg.event.delta) {
          process.stdout.write(msg.event.delta.text);
        }
      } else if (msg.event.type === 'message_start' || msg.event.type === 'message_stop') {
        console.log(`\n${formatHeader('stream', msg.event.type)}`);
      }
      // 其他流事件静默处理，避免日志过多
      break;
    }

    default: {
      const _exhaustiveCheck: never = msg;
      console.log(formatHeader((msg as any).type || 'unknown'));
      console.log(formatContent(msg));
      break;
    }
  }
}
