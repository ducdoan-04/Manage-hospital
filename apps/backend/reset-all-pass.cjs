const { PrismaClient } = require('@prisma/client'); 
const bcrypt = require('bcrypt');
const prisma = new PrismaClient(); 

async function main() { 
    console.log('Generating hash for Password123!...');
    const hash = await bcrypt.hash('Password123!', 12);
    
    console.log('Updating all users in the database...');
    const result = await prisma.user.updateMany({
        data: { passwordHash: hash }
    });
    
    console.log(`Successfully reset passwords for ${result.count} users to Password123!`); 
} 

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
