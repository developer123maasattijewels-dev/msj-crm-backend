const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Conversation = require('./src/models/Conversation');
const Message = require('./src/models/Message');
const User = require('./src/models/usermodel');

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('CONNECTED TO DB');

    const convs = await Conversation.find({}).lean();
    console.log('Total Conversations in DB:', convs.length);
    console.log('CONVERSATIONS LIST:');
    console.log(JSON.stringify(convs.map(c => ({
      _id: c._id,
      chatType: c.chatType,
      clientName: c.clientName,
      clientEmail: c.clientEmail,
      assignedTo: c.assignedTo,
      createdBy: c.createdBy,
      participants: c.participants,
      status: c.status,
      lastMessage: c.lastMessage
    })), null, 2));

    const msgs = await Message.find({}).sort({ createdAt: -1 }).limit(10).lean();
    console.log('Recent Messages:', msgs.length);
    console.log(JSON.stringify(msgs.map(m => ({
      _id: m._id,
      conversation: m.conversation,
      senderName: m.senderName,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt
    })), null, 2));

    const users = await User.find({ name: { $regex: 'Gajanand|Rajat', $options: 'i' } }).select('_id name role email designation').lean();
    console.log('USERS FOUND:');
    console.log(JSON.stringify(users, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Check DB Error:', err);
  }
}
test();

