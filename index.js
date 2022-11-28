const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

const app = express();
//middleware

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ewurel7.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
	const authHeader = req.headers.authorization;
	// console.log(authHeader);
	if (!authHeader) {
		return res.status(401).send("unauthorized access");
	}
	const token = authHeader.split(" ")[1];
	jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
		if (err) {
			return res.status(403).send({ message: "forbidden access" });
		}
		req.decoded = decoded;
		next();
	});
}

async function run() {
	try {
		const categoryCollection = client
			.db("goodWillStore")
			.collection("Categories");
		const userCollection = client.db("goodWillStore").collection("Users");
		const productCollection = client.db("goodWillStore").collection("Products");
		const bookingCollection = client
			.db("goodWillStore")
			.collection("bookingInfo");
		const paymentsCollection = client
			.db("goodWillStore")
			.collection("payments");

		app.post("/create-payment-intent", async (req, res) => {
			const booking = req.body;
			const itemPrice = booking.itemPrice;
			const amount = itemPrice * 100;

			// Create a PaymentIntent with the order amount and currency
			const paymentIntent = await stripe.paymentIntents.create({
				currency: "usd",
				amount: amount,
				payment_method_types: ["card"],
			});

			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});

		app.post("/payments", async (req, res) => {
			const payment = req.body;
			const result = await paymentsCollection.insertOne(payment);
			const id = payment.bookingId;
			const filter = { _id: ObjectId(id) };
			const updatedDoc = {
				$set: {
					paid: true,
					transactionId: payment.transactionId,
				},
			};
			const updateResult = await bookingCollection.updateOne(
				filter,
				updatedDoc
			);
			res.send(result);
		});

		app.get("/jwt", async (req, res) => {
			const email = req.query.email;

			const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
				expiresIn: "1h",
			});
			return res.send({ accessToken: token });
		});

		app.get("/users", async (req, res) => {
			const query = {};
			const result = await userCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/users/user/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: ObjectId(id) };
			const result = await userCollection.findOne(query);
			res.send(result);
		});

		app.get("/users/user-type/:userCategory", async (req, res) => {
			const userCategory = req.params.userCategory;
			const query =
				userCategory === undefined ? {} : { userCategory: userCategory };
			const result = await userCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/users/user/wishlist/:id", async (req, res) => {
			const id = req.params.id;
			const result = await userCollection.find(query).toArray();
			res.send(result);
		});

		// app.patch('/users/wishlist', async (req, res) => {
		// 	const updateDoc = {
		// 		$set: {
		// 			wishList: []
		// 		}
		// 	}
		// 	const result = await userCollection.updateMany({ userCategory: "Buyer" }, updateDoc, { upsert: true });
		// 	res.send(result);
		// });


		app.post("/users", verifyJWT, async (req, res) => {
			const user = req.body;
			let result = await userCollection.findOne({ email: user.email });
			if (result === null) {
				user.verify = "";
				user.wishList = [];
				result = await userCollection.insertOne(user);
			}
			res.send(result);
		});

		app.patch("/users/:id", async (req, res) => {
			const id = req.params.id;
			const verify = req.body.verify;
			const query = { _id: ObjectId(id) };
			const updateDoc = {
				$set: {
					verify: verify,
				},
			};
			const result = await userCollection.updateOne(query, updateDoc);
			res.send(result);
		});

		app.get("/users/admin/:email", async (req, res) => {
			const email = req.params.email;
			const query = { email };
			const user = await userCollection.findOne(query);
			res.send({ isAdmin: user?.role === "admin" });
		});

		app.get("/users/buyer/:email", async (req, res) => {
			const email = req.params.email;
			const query = { email };
			const user = await userCollection.findOne(query);
			res.send({ isBuyer: user?.userCategory === "Buyer" });
		});

		app.get("/users/seller/:email", async (req, res) => {
			const email = req.params.email;
			const query = { email };
			const user = await userCollection.findOne(query);
			res.send({ isSeller: user?.userCategory === "Seller" });
		});

		// app.get("/users/:userCategory", async (req, res) => {
		// 	const userCategory = req.params.userCategory;
		// 	const query = { userCategory: userCategory };
		// 	const result = await userCollection.find(query).toArray();
		// 	res.send(result);
		// });

		app.get("/categories", async (req, res) => {
			const query = {};
			const result = await categoryCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/products", async (req, res) => {
			const query = {};
			const result = await productCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/products/advertise", verifyJWT, async (req, res) => {
			const query = { advertiseEnable: true,status:"" };
			const result = await productCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/products/category/:id", async (req, res) => {
			const categoryId = req.params.id;
			const query = { categoryId: categoryId };
			//const result = await productCollection.find(query).toArray();
			const result = await productCollection
				.aggregate([
					//join with user collection
					{
						$lookup: {
							from: "Users", // other table name
							localField: "createdBy", // name of users table field
							foreignField: "email", // name of userinfo table field
							as: "user_info", // alias for userinfo table
						},
					},
					// define some conditions here
					{
						$match: {
							$and: [{ categoryId: categoryId }],
							$and: [{ status: "" }],
						},
					},
					// define which fields are you want to fetch
				])
				.toArray();
			res.send(result);
		});

		app.get("/products/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: id };
			const result = await productCollection.findOne(query);
			res.send(result);
		});

		app.get("/my-products", async (req, res) => {
			const email = req.query.email;
			console.log(email);
			const query = { createdBy: email };
			const result = await productCollection.find(query).toArray();
			res.json(result);
		});

		app.put("/my-products/:id", async (req, res) => {
			const id = req.params.id;
			const advertiseEnable = req.query.advertiseEnable;
			const status = req.query.status;
			const query = { _id: ObjectId(id) };
			const option = { upsert: true };
			let updateDoc = {};

			if (advertiseEnable !== undefined) {
				updateDoc = {
					$set: {
						advertiseEnable: advertiseEnable === "true" ? true : false,
						modifyAt: new Date().toISOString(),
					},
				};
			}

			if (status !== undefined && status === "SOLD") {
				updateDoc = {
					$set: {
						status: status,
						advertiseEnable: false,
						modifyAt: new Date().toISOString(),
					},
				};
			}

			if (status !== undefined && advertiseEnable !== undefined) {
				updateDoc = {
					$set: {
						status: status,
						advertiseEnable: advertiseEnable === "true" ? true : false,
						modifyAt: new Date().toISOString(),
					},
				};
			}

			const result = await productCollection.updateOne(
				query,
				updateDoc,
				option
			);
			res.send(result);
		});

		app.post("/products", async (req, res) => {
			const product = req.body;
			product.createdAt = new Date();
			product.status = "";
			product.advertiseEnable = false;
			const result = await productCollection.insertOne(product);
			res.send(result);
		});

		app.post("/bookings", async (req, res) => {
			const booking = req.body;
			booking.createdAt = new Date();
			const result = await bookingCollection.insertOne(booking);
			res.send(result);
		});

		app.get("/bookings",  async (req, res) => {
			const email = req.query.email;
			// const decodedEmail = req.decoded.email;
			// if (email !== decodedEmail) {
			// 	return res.status(403).send({ message: "forbidden access" });
			// }
			const query = { email: email };
			const result = await bookingCollection.find(query).toArray();
			res.json(result);
		});

		app.get("/bookings/:id", async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const result = await bookingCollection.findOne(filter);
			res.send(result);
		});

		app.put("/products/:id", async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const product = req.body;
			const option = { upsert: true };
			const updatedProduct = {
				$set: {
					message: product.soldStatus,
					modifyAt: new Date().toISOString(),
				},
			};
			const result = await productCollection.updateOne(
				filter,
				updatedProduct,
				option
			);
			res.send(result);
		});

		// app.patch('/products', async(req,res)=>{
		//     const updateDoc={
		//         $set:{
		//             advertiseEnable: false
		//         }
		//     }
		//     const result= await productCollection.updateMany({},updateDoc,{upsert: true});
		//     res.send(result);
		// })

		app.delete("/my-products/:id", async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const result = await productCollection.deleteOne(filter);
			res.send(result);
		});

		app.delete("/users/:id", async (req, res) => {
			const id = req.params.id;
			const filter = { _id: ObjectId(id) };
			const result = await userCollection.deleteOne(filter);
			res.send(result);
		});

		app.get("/my-products", async (req, res) => {
			const userId = req.body.userId;
			const query = { owner: userId };
			const result = await productCollection
				.find(query)
				.sort({ creationDate: -1 })
				.toArray();
			res.send(result);
		});

		app.post("/payments", async (req, res) => {
			const payment = req.body;
			const result = await paymentsCollection.insertOne(payment);
			const id = payment.bookingId;
			const filter = { _id: ObjectId(id) };
			const updatedDoc = {
				$set: {
					paid: true,
					transactionId: payment.transactionId,
				},
			};
			const updateResult = await bookingCollection.updateOne(
				filter,
				updatedDoc
			);
			res.send(result);
		});

		app.get("/payments", async (req, res) => {
			const result = await paymentsCollection.find({}).toArray();
			res.send(result);
		});
	} finally {
	}
}
run().catch(console.log);

app.get("/", async (req, res) => {
	res.send("goodwill store is running");
});

app.listen(port, () => console.log(`goodwill store is running on ${port}`));
