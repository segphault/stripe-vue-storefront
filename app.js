const keyPublishable = process.env.PUBLISHABLE_KEY;
const keySecret = process.env.SECRET_KEY;

const express = require("express");
const fallback = require("express-history-api-fallback");
const body = require("body-parser");
const stripe = require("stripe")(keySecret);

const app = express();

app.use(body.urlencoded({extended: false}));
app.use(body.json());

app.get("/stripe/key", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.send(`const keyPublishable = "${keyPublishable}";`);
});

app.get("/api/products", (req, res) =>
  stripe.products.list()
  .then(({data}) => res.json(data)));

app.get("/api/products/:id", (req, res) =>
  stripe.products.retrieve(req.params.id)
  .then(item => res.json([item])));

app.post("/api/order", (req, res) => {
  let {email, items, source, shipping} = req.body;
  stripe.orders.create({currency: "usd", email, items, shipping})
  .then(({id}) => stripe.orders.pay(id, {source}))
  .then(charge => res.send(charge))
  .catch(err => {
    console.log("Error:", err);
    res.status(500).send({error: "Purchase Failed"});
  });
});

app.use(express.static("public"));
app.use(fallback("index.html", {root: "public"}));

app.listen(8000);
