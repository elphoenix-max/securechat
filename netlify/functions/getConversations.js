const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Elphoenix:Wejsrenvrai@securechat.dpxhgbg.mongodb.net/securechat';

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userCode } = JSON.parse(event.body);

    if (!userCode) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Code utilisateur requis' })
      };
    }

    const client = await connectToDatabase();
    const db = client.db('securechat');
    const messagesCollection = db.collection('messages');

    // Trouver tous les messages où l'utilisateur est soit sender soit receiver
    const messages = await messagesCollection.find({
      $or: [
        { sender: userCode },
        { receiver: userCode }
      ]
    }).sort({ timestamp: 1 }).toArray();

    // Organiser les messages par conversation
    const conversationsMap = {};

    for (const message of messages) {
      // Créer l'ID de conversation (codes triés)
      const chatId = [message.sender, message.receiver].sort().join('_');
      
      if (!conversationsMap[chatId]) {
        conversationsMap[chatId] = {
          participants: [message.sender, message.receiver],
          messages: [],
          createdAt: message.timestamp
        };
      }
      
      conversationsMap[chatId].messages.push({
        id: message._id.toString(),
        sender: message.sender,
        receiver: message.receiver,
        encrypted: message.encrypted,
        original: message.original,
        timestamp: new Date(message.timestamp).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(conversationsMap)
    };

  } catch (error) {
    console.error('Get conversations error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur serveur',
        message: error.message 
      })
    };
  }
};