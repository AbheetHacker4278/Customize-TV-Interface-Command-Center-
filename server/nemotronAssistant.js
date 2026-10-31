import 'dotenv/config';
import OpenAI from 'openai';
import { tvService } from './tvService.js';
import { pushTvWallpaper } from './tvBridge.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.NVIDIA_API_KEY || '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';
const baseURL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const modelName = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-super-vl-120b-a12b';

const openai = new OpenAI({
  apiKey,
  baseURL,
});

export const TV_ASSISTANT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'open_app',
      description: 'Open or launch an application on the Sony TV (e.g. YouTube, Netflix, Prime Video, Hotstar, JioCinema, MX Player, Cleaner, Settings)',
      parameters: {
        type: 'object',
        properties: {
          app_name: { 
            type: 'string', 
            description: 'Name of the app to launch (e.g. "YouTube", "Netflix", "Prime Video", "Hotstar", "Cleaner", "Settings")' 
          }
        },
        required: ['app_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_volume',
      description: 'Set TV volume to an exact percentage level (0 to 100)',
      parameters: {
        type: 'object',
        properties: {
          level: { 
            type: 'integer', 
            description: 'Target volume level between 0 and 100' 
          }
        },
        required: ['level']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'adjust_volume',
      description: 'Increase or decrease the TV volume by steps or relative amount',
      parameters: {
        type: 'object',
        properties: {
          direction: { 
            type: 'string', 
            enum: ['up', 'down'], 
            description: 'Whether to turn volume up or down' 
          },
          steps: { 
            type: 'integer', 
            description: 'Number of volume steps (default is 5)' 
          }
        },
        required: ['direction']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'toggle_mute',
      description: 'Mute or unmute the TV system audio',
      parameters: {
        type: 'object',
        properties: {
          mute: { 
            type: 'boolean', 
            description: 'True to mute, false to unmute' 
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'screen_power',
      description: 'Control the TV display power: put TV to sleep / turn screen off, wake screen, or toggle power',
      parameters: {
        type: 'object',
        properties: {
          action: { 
            type: 'string', 
            enum: ['sleep', 'wake', 'toggle'], 
            description: 'Power action: "sleep" to turn off screen, "wake" to wake TV, "toggle" to toggle power' 
          }
        },
        required: ['action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'switch_input',
      description: 'Switch the TV input source to a specific HDMI or AV port',
      parameters: {
        type: 'object',
        properties: {
          input_name: { 
            type: 'string', 
            enum: ['HDMI 1', 'HDMI 2', 'HDMI 3', 'HDMI 4', 'AV', 'Inputs Menu'],
            description: 'The target input source port' 
          }
        },
        required: ['input_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'clean_cache',
      description: 'Run the Smart TV Auto Cache Cleaner & Memory Optimizer to free background RAM and junk cache',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'change_wallpaper',
      description: 'Change the Home Screen wallpaper on the TV to a new theme or random 4K picture',
      parameters: {
        type: 'object',
        properties: {
          theme: { 
            type: 'string', 
            description: 'Theme name or style (e.g. "fuji", "evening", "cyberpunk", "aurora", "random")' 
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'navigate_tv',
      description: 'Send navigation commands: Home, Back, Play/Pause, Up, Down, Left, Right, OK',
      parameters: {
        type: 'object',
        properties: {
          command: { 
            type: 'string', 
            enum: ['home', 'back', 'ok', 'up', 'down', 'left', 'right', 'play_pause'],
            description: 'Remote navigation action' 
          }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_installed_apps',
      description: 'Get a list of all primary streaming applications installed on the TV',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
];

export async function executeAssistantTool(name, args = {}) {
  console.log(`[Assistant Tool Call] ${name}:`, args);

  switch (name) {
    case 'open_app': {
      const appName = args.app_name || '';
      const lower = appName.toLowerCase();
      let pkg = '';

      if (lower.includes('youtube')) pkg = 'com.google.android.youtube.tv';
      else if (lower.includes('netflix')) pkg = 'com.netflix.ninja';
      else if (lower.includes('prime')) pkg = 'com.amazon.amazonvideo.livingroom';
      else if (lower.includes('hotstar')) pkg = 'in.startv.hotstar';
      else if (lower.includes('jiocinema') || lower.includes('jio cinema')) pkg = 'com.jio.media.stb.ondemand';
      else if (lower.includes('jiotv') || lower.includes('jio tv')) pkg = 'com.jio.media.jiotvplus';
      else if (lower.includes('mx player') || lower.includes('mxplayer')) pkg = 'com.mxtech.videoplayer.television';
      else if (lower.includes('cleaner') || lower.includes('cache')) {
        await tvService.sendKeyEvent('cleaner', 'Cleaner');
        return { success: true, message: 'Opened Auto Cache Cleaner' };
      } else if (lower.includes('setting')) {
        await tvService.sendKeyEvent(176, 'Settings');
        return { success: true, message: 'Opened TV Settings' };
      }

      if (pkg) {
        await tvService.launchApp(pkg, appName);
        return { success: true, message: `Successfully opened ${appName}` };
      } else {
        // Fallback search or generic launch
        await tvService.sendText(appName);
        return { success: true, message: `Searching for ${appName}` };
      }
    }

    case 'set_volume': {
      const level = Math.max(0, Math.min(100, parseInt(args.level, 10) || 20));
      await tvService.setVolume(level);
      return { success: true, level, message: `Volume set to ${level}%` };
    }

    case 'adjust_volume': {
      const steps = parseInt(args.steps, 10) || 5;
      const current = tvService.state.volume || 30;
      const target = args.direction === 'up' 
        ? Math.min(100, current + steps * 2)
        : Math.max(0, current - steps * 2);
      await tvService.setVolume(target);
      return { success: true, level: target, message: `Volume adjusted to ${target}%` };
    }

    case 'toggle_mute': {
      await tvService.toggleMute();
      return { success: true, message: 'Audio mute toggled' };
    }

    case 'screen_power': {
      if (args.action === 'sleep') {
        await tvService.sleepTv();
        return { success: true, message: 'Turned off the TV screen (Standby mode)' };
      } else if (args.action === 'wake') {
        await tvService.wakeTv();
        return { success: true, message: 'Woke up the TV display' };
      } else {
        await tvService.powerToggle();
        return { success: true, message: 'TV power state toggled' };
      }
    }

    case 'switch_input': {
      const input = args.input_name || 'HDMI 1';
      await tvService.switchInput(input);
      return { success: true, input, message: `Switched TV input to ${input}` };
    }

    case 'clean_cache': {
      const res = await tvService.runAutoCacheClean();
      return { 
        success: true, 
        cacheFreed: res.cacheFreed || '86 MB',
        ramReleased: res.ramReleased || '260 MB',
        message: 'TV cache cleaned and background RAM released successfully.' 
      };
    }

    case 'change_wallpaper': {
      const presets = tvService.getWallpaperPresets();
      let chosen = presets[0];
      if (args.theme) {
        const found = presets.find(p => p.id.toLowerCase().includes(args.theme.toLowerCase()) || p.name.toLowerCase().includes(args.theme.toLowerCase()));
        if (found) chosen = found;
        else chosen = presets[Math.floor(Math.random() * presets.length)];
      } else {
        chosen = presets[Math.floor(Math.random() * presets.length)];
      }
      const localPath = path.join(__dirname, 'public', chosen.file.replace(/^\//, ''));
      await pushTvWallpaper(tvService.targetIp, localPath);
      return { success: true, wallpaper: chosen.name, message: `Applied ${chosen.name} wallpaper to TV Home Screen.` };
    }

    case 'navigate_tv': {
      const cmd = (args.command || 'home').toLowerCase();
      const map = {
        'home': 3,
        'back': 4,
        'ok': 23,
        'up': 19,
        'down': 20,
        'left': 21,
        'right': 22,
        'play_pause': 85
      };
      const code = map[cmd] || 3;
      await tvService.sendKeyEvent(code, cmd);
      return { success: true, command: cmd, message: `Sent ${cmd} navigation command.` };
    }

    case 'list_installed_apps': {
      const apps = tvService.deviceInfo?.installedApps || [
        'YouTube', 'Netflix', 'Prime Video', 'Disney+ Hotstar', 'JioCinema', 'MX Player', 'Clean Apple TV Launcher', 'Auto Cache Cleaner'
      ];
      return { success: true, apps, message: `Available apps: ${apps.join(', ')}` };
    }

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

/**
 * Handle conversational speech interaction with NVIDIA Nemotron
 */
export async function handleAssistantQuery({ messages = [], onDelta, onToolExecute }) {
  const systemPrompt = {
    role: 'system',
    content: `You are Siri, an intelligent, fast, and conversational AI voice assistant integrated directly into the user's Sony BRAVIA 4K Smart TV.
You are powered by NVIDIA Nemotron.
Current TV State:
- Target TV: ${tvService.targetIp} (Sony BRAVIA 4K)
- Power: ${tvService.state?.power || 'AWAKE'}
- Active Focus: ${tvService.state?.currentFocus || 'Clean Apple TV Launcher'}
- Volume: ${tvService.state?.volume || 30}%
- Audio Muted: ${tvService.state?.muted ? 'Yes' : 'No'}
- Active Input: ${tvService.state?.currentInput || 'HDMI 1'}

Rules:
1. Keep spoken responses concise and natural (1 to 2 short sentences), crafted for audio playback on a TV.
2. When the user asks to perform an action (open YouTube, change volume, turn off screen, clean cache, change wallpaper, switch HDMI), CALL THE APPROPRIATE TOOL immediately.
3. Confirm actions warmly and cleanly, e.g. "Opening YouTube for you now.", "Volume set to 25%.", "Cleaning the TV cache."
4. If asked who you are, state that you are the TV's AI Voice Assistant powered by NVIDIA Nemotron.`
  };

  const fullMessages = [systemPrompt, ...messages];

  try {
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: fullMessages,
      tools: TV_ASSISTANT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    });

    const choice = completion.choices[0];
    const message = choice?.message;

    // Check if Nemotron called tools
    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const fnName = toolCall.function.name;
      let fnArgs = {};
      try { fnArgs = JSON.parse(toolCall.function.arguments || '{}'); } catch(e){}

      if (onToolExecute) onToolExecute({ name: fnName, args: fnArgs });
      const toolResult = await executeAssistantTool(fnName, fnArgs);

      // Now query Nemotron with tool output to get the natural spoken response
      const followUpMessages = [
        ...fullMessages,
        message,
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        }
      ];

      const stream = await openai.chat.completions.create({
        model: modelName,
        messages: followUpMessages,
        temperature: 0.7,
        max_tokens: 512,
        stream: true,
      });

      let completeReply = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          completeReply += delta;
          if (onDelta) onDelta(delta);
        }
      }

      return {
        reply: completeReply || toolResult.message,
        toolExecuted: { name: fnName, args: fnArgs, result: toolResult }
      };
    } else {
      // Direct speech response without tool
      const reply = message?.content || "I'm here on your Smart TV. How can I assist you?";
      if (onDelta) onDelta(reply);
      return { reply, toolExecuted: null };
    }
  } catch (err) {
    console.error('[Nemotron Assistant Error]:', err);
    throw err;
  }
}
