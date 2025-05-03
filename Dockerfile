# Use official Node.js image
FROM node:20

# Create app directory
WORKDIR /app


# Copy files
COPY package*.json ./
COPY . .

# Install dependencies
RUN npm install

# Start the bot
CMD ["node", "index.js"]
