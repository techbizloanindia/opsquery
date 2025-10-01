import { NextRequest, NextResponse } from 'next/server';
import { ChatStorageService } from '@/lib/services/ChatStorageService';
import { broadcastQueryUpdate } from '@/lib/eventStreamUtils';

interface MessageData {
  queryId: string;
  appNo?: string;
  message: string;
  sender: string;
  senderRole: string;
  team: string;
  type: 'message' | 'reply' | 'remark';
  customerName?: string;
}

// POST - Send a new message (universal endpoint for all message types)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      queryId, 
      appNo, 
      message, 
      sender, 
      senderRole, 
      team, 
      type = 'message',
      customerName
    }: MessageData = body;
    
    if (!queryId || !message || !sender || !senderRole || !team) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: queryId, message, sender, senderRole, team' 
        },
        { status: 400 }
      );
    }

    const timestamp = new Date();
    
    // Create comprehensive message data
    const messageData = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      queryId: queryId,
      appNo: appNo || `APP-${queryId}`,
      message,
      responseText: message,
      sender,
      senderRole,
      team: team.toLowerCase(),
      timestamp: timestamp.toISOString(),
      isSystemMessage: false,
      actionType: type
    };

    // 1. Store in global message database for real-time access with proper queryId isolation
    if (typeof global !== 'undefined') {
      if (!global.queryMessagesDatabase) {
        global.queryMessagesDatabase = [];
      }
      
      // Ensure queryId is stored as string for consistent comparison
      const globalMessage = {
        ...messageData,
        queryId: queryId.toString(), // Store as string to prevent type mismatch
        originalQueryId: queryId // Keep original for debugging
      };
      
      // ULTRA-STRICT duplicate check with enhanced isolation validation
      const isDuplicate = global.queryMessagesDatabase.some(existing => {
        const existingQueryId = existing.queryId?.toString();
        const newQueryId = globalMessage.queryId?.toString();

        // Check if same query and same content with stricter validation
        const sameQuery = existingQueryId === newQueryId;
        const sameMessage = existing.message === globalMessage.message;
        const sameSender = existing.sender === globalMessage.sender;
        const sameTimeWindow = Math.abs(new Date(existing.timestamp).getTime() - new Date(globalMessage.timestamp).getTime()) < 5000;

        // Additional safety: check for exact length match to prevent substring issues
        const safeLengthMatch = existingQueryId?.length === newQueryId?.length;

        return sameQuery && sameMessage && sameSender && sameTimeWindow && safeLengthMatch;
      });
      
      if (!isDuplicate) {
        global.queryMessagesDatabase.push(globalMessage);
        console.log(`✅ Added message to global database for query ${queryId} (thread isolated)`);
      } else {
        console.log(`⚠️ Duplicate message detected for query ${queryId}, skipping global storage`);
      }
    }

    // 2. Store in MongoDB using ChatStorageService
    try {
      const stored = await ChatStorageService.storeChatMessage({
        queryId,
        message,
        responseText: message,
        sender,
        senderRole,
        team: team.toLowerCase(),
        timestamp,
        isSystemMessage: false,
        actionType: type as any
      });
      
      if (stored && stored._id) {
        console.log(`💾 Message stored to database: ${stored._id}`);
        messageData.id = stored._id.toString();
      }
    } catch (dbError) {
      console.error('Error storing message to database:', dbError);
      // Continue with broadcast even if DB storage fails
    }

    // 3. Broadcast to all dashboards
    try {
      console.log(`📡 Broadcasting ${type} from ${team} team to all dashboards`);
      
      const broadcastData = {
        id: queryId,
        appNo: messageData.appNo,
        customerName: customerName || 'Customer',
        action: 'message_added',
        team: team.toLowerCase(),
        markedForTeam: 'both', // Notify all teams
        newMessage: {
          id: messageData.id,
          text: message,
          author: sender,
          authorTeam: team,
          timestamp: messageData.timestamp
        },
        broadcast: true,
        messageFrom: team,
        priority: 'high'
      };
      
      // Broadcast to all teams
      broadcastQueryUpdate(broadcastData);
      
      // Also broadcast specifically to each team
      ['operations', 'sales', 'credit'].forEach(targetTeam => {
        if (targetTeam !== team.toLowerCase()) {
          const teamSpecificData = {
            ...broadcastData,
            markedForTeam: targetTeam
          };
          broadcastQueryUpdate(teamSpecificData);
        }
      });
      
      console.log(`🎯 ${type} from ${team} team broadcasted to all dashboards (operations, sales, credit)`);
      
    } catch (broadcastError) {
      console.error('❌ Error broadcasting message:', broadcastError);
    }

    console.log(`✅ ${type} processed successfully:`, {
      queryId,
      team,
      sender,
      messageLength: message.length
    });

    return NextResponse.json({
      success: true,
      data: messageData,
      message: `${type} sent successfully`
    });

  } catch (error: any) {
    console.error('💥 Error processing message:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process message' },
      { status: 500 }
    );
  }
}

// GET - Retrieve all messages for a query
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('queryId');
    const team = searchParams.get('team');
    const includeAll = searchParams.get('includeAll') === 'true';
    
    if (!queryId) {
      return NextResponse.json(
        { success: false, error: 'Missing queryId parameter' },
        { status: 400 }
      );
    }

    let messages: any[] = [];

    // Get from global message database with ULTRA-STRICT queryId filtering
    if (typeof global !== 'undefined' && global.queryMessagesDatabase) {
      const queryIdStr = queryId.toString();

      const globalMessages = global.queryMessagesDatabase
        .filter((msg: any) => {
          // ULTRA-STRICT comparison to prevent cross-query contamination
          const msgQueryId = msg.queryId?.toString();
          const originalQueryId = msg.originalQueryId?.toString();

          // Multiple validation layers
          const primaryMatch = msgQueryId === queryIdStr;
          const secondaryMatch = originalQueryId === queryIdStr;

          // Additional safety checks
          const isValidLength = (msgQueryId?.length === queryIdStr.length) ||
                               (originalQueryId?.length === queryIdStr.length);

          // Final validation: exact match with length check
          const isSafeMatch = (primaryMatch || secondaryMatch) && isValidLength;

          if (isSafeMatch) {
            console.log(`✅ ULTRA-SAFE global message retrieval for query ${queryIdStr}`);
          } else if (primaryMatch || secondaryMatch) {
            console.warn(`⚠️ Blocked cross-query contamination in message retrieval: target=${queryIdStr}, msgId=${msgQueryId}, origId=${originalQueryId}`);
          }

          return isSafeMatch;
        })
        .map((msg: any) => ({
          id: msg.id,
          queryId: queryId,
          message: msg.message || msg.responseText,
          sender: msg.sender,
          senderRole: msg.senderRole || msg.team,
          team: msg.team || msg.senderRole,
          timestamp: msg.timestamp,
          type: msg.actionType || 'message'
        }));
      
      console.log(`🔒 Retrieved ${globalMessages.length} isolated messages for query ${queryId} from global database`);
      messages = [...messages, ...globalMessages];
    }

    // Get from ChatStorageService
    try {
      const chatMessages = await ChatStorageService.getChatMessages(queryId);
      
      if (chatMessages && chatMessages.length > 0) {
        const dbMessages = chatMessages.map(msg => ({
          id: msg._id?.toString() || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          queryId: queryId,
          message: msg.message || msg.responseText,
          sender: msg.sender,
          senderRole: msg.senderRole,
          team: msg.team,
          timestamp: msg.timestamp.toISOString(),
          type: msg.actionType || 'message'
        }));
        
        messages = [...messages, ...dbMessages];
      }
    } catch (dbError) {
      console.warn('Failed to load from ChatStorageService:', dbError);
    }

    // Remove duplicates
    const uniqueMessages = messages.filter((message, index, self) => 
      index === self.findIndex(m => 
        m.message === message.message && 
        m.sender === message.sender && 
        Math.abs(new Date(m.timestamp).getTime() - new Date(message.timestamp).getTime()) < 5000
      )
    );

    // Sort by timestamp
    uniqueMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Filter by team if specified
    const filteredMessages = team && !includeAll 
      ? uniqueMessages.filter(msg => msg.team?.toLowerCase() === team.toLowerCase())
      : uniqueMessages;

    return NextResponse.json({
      success: true,
      data: filteredMessages,
      count: filteredMessages.length,
      totalCount: uniqueMessages.length
    });

  } catch (error: any) {
    console.error('💥 Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// Make queryMessagesDatabase accessible globally
declare global {
  var queryMessagesDatabase: any[];
}