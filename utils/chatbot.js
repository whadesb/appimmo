const { NlpManager } = require('node-nlp');

// Création du manager pour le français
const manager = new NlpManager({ languages: ['fr'], forceNER: true, nlu: { log: false } });

// Fonction d'entraînement (à appeler au démarrage du serveur)
async function trainChatbot() {
    console.log('🤖 Entraînement du Chatbot en cours...');

    // 1. INTENTION : SALUTATION
    manager.addDocument('fr', 'bonjour', 'greetings.hello');
    manager.addDocument('fr', 'salut', 'greetings.hello');
    manager.addDocument('fr', 'hey', 'greetings.hello');
    manager.addAnswer('fr', 'greetings.hello', 'Bonjour ! Je suis votre assistant UAP. Comment puis-je vous aider ?');

    // 2. INTENTION : PAIEMENT CRYPTO
    manager.addDocument('fr', 'comment payer en bitcoin', 'payment.btc');
    manager.addDocument('fr', 'payer en crypto', 'payment.btc');
    manager.addDocument('fr', 'btcpay', 'payment.btc');
    manager.addDocument('fr', 'c\'est sécurisé le bitcoin ?', 'payment.btc');
    manager.addAnswer('fr', 'payment.btc', 'Nous utilisons BTCPay Server pour les paiements en Bitcoin. C\'est sécurisé et direct. Vous pouvez choisir cette option à la fin de la commande.');

    // 3. INTENTION : MOT DE PASSE (Navigation)
    manager.addDocument('fr', 'changer mon mot de passe', 'account.password');
    manager.addDocument('fr', 'j\'ai perdu mon mot de passe', 'account.password');
    manager.addDocument('fr', 'reset password', 'account.password');
    // Pas de réponse texte ici, le serveur gérera une action spéciale

    // 4. INTENTION : MES COMMANDES (Data)
    manager.addDocument('fr', 'où sont mes commandes', 'order.status');
    manager.addDocument('fr', 'est-ce que ma commande est validée', 'order.status');
    manager.addDocument('fr', 'statut de ma commande', 'order.status');
    // Le serveur répondra dynamiquement avec les données de la BDD

    // 5. INTENTION : AIDE / SUPPORT
    manager.addDocument('fr', 'je ne comprends pas', 'agent.help');
    manager.addDocument('fr', 'aidez moi', 'agent.help');
    manager.addAnswer('fr', 'agent.help', 'Je suis là pour vous aider. Vous pouvez me poser des questions sur vos commandes, vos annonces ou les paiements.');

    await manager.train();
    manager.save();
    console.log('🤖 Chatbot prêt et entraîné !');
}

module.exports = { manager, trainChatbot };
