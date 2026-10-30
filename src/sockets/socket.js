const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error("Authentication required"));
            }

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

            const userId =
                decoded.id ||
                decoded._id ||
                decoded.userId;

            if (!userId) {
                return next(new Error("Invalid user token"));
            }

            socket.userId = userId.toString();
            next();

        } catch (error) {
            next(new Error("Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        const room = `user_${socket.userId}`;

        socket.join(room);

        console.log("User connected:", socket.userId);

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.userId);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.IO is not initialized");
    }

    return io;
};

const sendNotification = (userId, notification) => {
    getIO().to(`user_${userId}`).emit(
        "new_notification",
        notification
    );
};

module.exports = {
    initSocket,
    getIO,
    sendNotification
};