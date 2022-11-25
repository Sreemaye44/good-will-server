const express=require('express');
const cors=require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port=process.env.PORT||5000;

const app=express();
//middleware

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ewurel7.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// const PRODUCT = {
//     name,
//     imageUri,
//     price,
//     condition,
//     mobileNumber,
//     location,
//     description,
//     purchaseYear,
//     categoryId,
//     ownerId,
//     createdAt,
//     modifiedAt
// }

// const USER ={
//     name,
//     email,
//     address,
//     mobileNumber,
//     role,
//     enable,
//     createdAt,
//     modifiedAt
// }

// const CATEGORY ={
//     categoryName,
//     photo,
//     createdAt,
//     modifiedAt
// }

async function run(){
    try{

        const categoryCollection=client.db('goodWillStore').collection('Categories');
        const userCollection=client.db('goodWillStore').collection('Users');
        const productCollection=client.db('goodWillStore').collection('Products');

        
        app.get('/users/:id', async(req,res)=>{
            const id=req.params.id;
            const query={_id: ObjectId(id)};
            const result=await userCollection.findOne(query);
            res.send(result)
        })

        app.get('/users', async(req,res)=>{
            const query={};
            const result=await userCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/users', async(req,res)=>{
            const user = req.body;
            const result= await userCollection.insertOne(user);
            res.send(result);
        })

        app.get('/categories', async(req,res)=>{
            const query={};
            const result=await categoryCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/categories/:id', async(req,res)=>{
            const categoryId = req.params.id;
            const query={categoryId:categoryId};
            console.log(query);
            const result=await productCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/products/:id', async(req,res)=>{
            const id=req.params.id;
            const query={_id: ObjectId(id)};
            const result=await productCollection.findOne(query);
            res.send(result)
        })

        app.get('/products', async(req,res)=>{
            const query={};
            const result=await productCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/products', async(req,res)=>{
            const product = req.body;
            product.createdAt = new Date();
            product.status = "";
            const result= await productCollection.insertOne(product);
            res.send(result);
        })

        app.put('/products/:id', async(req,res)=>{
            const id= req.params.id;
            const filter={_id: ObjectId(id)};
            const product= req.body;
            const option= {upsert: true};
            const updatedProduct={
                $set: {
                    message: product.soldStatus,
                    modifyAt: new Date()
                }
            }
            const result= await productCollection.updateOne(filter, updatedProduct, option);
            res.send(result);
        })

        app.get('/my-products', async(req,res)=>{
            const userId = req.body.userId;
            const  query = {owner:userId};
            const result= await productCollection.find(query).sort({"creationDate":-1}).toArray();
            res.send(result);
        })

        
    }
    finally{

    }

   
}
run().catch(console.log);

app.get('/',async(req,res)=>{
    res.send('goodwill store is running')
})

app.listen(port, ()=>console.log(`goodwill store is running on ${port}`))