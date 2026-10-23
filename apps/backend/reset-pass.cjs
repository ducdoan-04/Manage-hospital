const { PrismaClient } = require('@prisma/client'); 
const bcrypt = require('bcrypt');
const prisma = new PrismaClient(); 
async function main() { 
    const hash = await bcrypt.hash('Password123!', 12);
    await prisma.user.update({
        where: { email: 'ducdoan326@gmail.com' },
        data: { passwordHash: hash }
    });
    console.log('Password reset successfully'); 
} 
main().finally(() => prisma.$disconnect());
