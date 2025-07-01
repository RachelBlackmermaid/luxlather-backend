import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';

dotenv.config();

const oils = [
    {
        name: "Lavendar Oil",
        price: 48,
        imageSrc: "/oil1.png",
        description: "Tall slender porcelain bottle with natural clay textured body and cork stopper.",
        category: "oil"
      },
      {
        name: "Batana Oil",
        price: 35,
        imageSrc: "/oil2.png",
        description: "Olive drab green insulated bottle with flared screw lid and flat top.",
        category: "oil"
      },
      {
        name: "Castor Oil",
        price: 89,
        imageSrc: "/oil5.png",
        description: "Person using a pen to cross a task off a productivity paper card.",
        category: "oil"
      },
      {
        name: "Rose Oil",
        price: 35,
        imageSrc: "/oil4.png",
        description: "Hand holding black machined steel mechanical pencil with brass tip and top.",
        category: "oil"
      }
    ];
    
    const soaps = [
      {
        name: "Orange Soap",
        price: 48,
        imageSrc: "/soap1.png",
        description: "Tall slender porcelain bottle with natural clay textured body and cork stopper.",
        category: "soap"
      },
      {
        name: "Lime Soap",
        price: 35,
        imageSrc: "/soap2.png",
        description: "Olive drab green insulated bottle with flared screw lid and flat top.",
        category: "soap"
      },
      {
        name: "Citrus Soap",
        price: 89,
        imageSrc: "/soap3.png",
        description: "Person using a pen to cross a task off a productivity paper card.",
        category: "soap"
      },
      {
        name: "All Purpose",
        price: 35,
        imageSrc: "/soap4.png",
        description: "Hand holding black machined steel mechanical pencil with brass tip and top.",
        category: "soap"
      }
    ];

    const seedProducts = async () => { 
        try {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('connected to MongoDB');

            //optional:clear existing 
            await Product.deleteMany();
            console.log('Existing products removed');

            //insert new data
            await Product.insertMany([...oils, ...soaps]);
            console.log('New products inserted');

            process.exit();
            
        } catch (err) {
            console.error('Seed error:', err);
            process.exit(1);
            
        }
    };

    seedProducts();