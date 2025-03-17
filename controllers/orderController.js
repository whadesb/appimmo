const Order = require("../models/Order");
const getNextOrderId = require("../utils/getNextOrderId"); // 🔹 Import de la fonction pour générer l'Order ID

const createOrder = async (req, res) => {
    try {
        const { userId, amount, pageUrl } = req.body;

        if (!userId || !amount) {
            return res.status(400).json({ error: "userId et amount sont requis." });
        }

        let orderId;
        let isUnique = false;

        // 🔹 Vérification d'unicité avant d'enregistrer
        while (!isUnique) {
            orderId = getNextOrderId(); // Génère un nouvel Order ID
            const existingOrder = await Order.findOne({ orderId });
            if (!existingOrder) {
                isUnique = true;
            }
        }

        const newOrder = new Order({
            orderId,  // 🔹 Order ID unique
            userId,
            amount,
            pageUrl,
            status: "pending"
        });

        await newOrder.save();
        res.status(201).json(newOrder);
    } catch (error) {
        console.error("Erreur lors de la création de la commande :", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
};

module.exports = { createOrder };
