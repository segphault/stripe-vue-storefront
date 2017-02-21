
const stripe = Stripe(keyPublishable);
const elements = stripe.elements();
const cardField = elements.create("card");

const filters = {
  dollars(value) {
    if (!value) return "";
    let amount = value / 100;
    return amount % 1 === 0 ? amount : amount.toFixed(2);
  }
};

let store = {
  products: {},
  cart: JSON.parse(localStorage.getItem("cart")) || {},
  load(id = "") {
    return fetch(`/api/products/${id}`)
    .then(response => response.json())
    .then(items => items.forEach(item => Vue.set(this.products, item.id, item)));
  },
  addToCart(sku, quantity = 1) {
    let product = this.products[sku.product];
    if (this.cart[sku.id]) this.cart[sku.id].quantity += quantity;
    else Vue.set(this.cart, sku.id, {product, sku, quantity});
    this.saveCart();
  },
  removeFromCart(sku) {
    Vue.delete(this.cart, sku.id);
    this.saveCart();
  },
  clearCart() {
    this.cart = {};
    this.saveCart();
  },
  saveCart() {
    localStorage.setItem("cart", JSON.stringify(this.cart));
  },
  order(source, email, shipping) {
    let items = Object.values(this.cart).map(item =>
      ({type: "sku", parent: item.sku.id, quantity: item.quantity}));

    return fetch("/api/order", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({items, source, email, shipping})
    });
  }
}

const ProductAttributes = {
  name: "product-attributes",
  props: ["sku"],
  template: `
  <ul class="attributes">
    <li class="attribute" v-for="(value, key) in sku.attributes">
      <span class="key" v-text="key"></span>: <span class="value" v-text="value"></span>
    </li>
  </ul>
  `
};

const ProductDetails = {
  name: "product-details",
  template: `
  <div class="product-details" v-if="this.product">
    <h2 v-text="product.caption"></h2>
    <p v-text="product.description"></p>

    <img class="image" :src="product.images[0]">

    <div class="purchase" v-if="selection">
      <label>
        Quantity: &nbsp;
        <input class="quantity" type="number" v-model="quantity">
      </label>
      <button @click="add">Add to Cart</button>
      <span class="price">Total: \${{selection.price * quantity | dollars}}</span>
    </div>

    <template v-if="product.skus.data.length > 1">
      <h3>Select a Configuration</h3>
      <div class="configurations">
        <div class="configuration" v-for="sku in product.skus.data"
             @click="selected = sku" :class="{selected: sku === selection}">
          <product-attributes :sku="sku"></product-attributes>
          <div class="price">\${{sku.price | dollars}}</div>
        </div>
      </div>
    </template>
  </div>
  <div v-else>
    <p>Loading...</p>
  </div>
  `,
  filters,
  components: {ProductAttributes},
  data() {
    return {store, quantity: 1, selected: null};
  },
  created() {
    if (!this.product)
      this.store.load(this.$route.params.id);
  },
  computed: {
    product() {
      return this.store.products[this.$route.params.id];
    },
    selection() {
      return this.selected || this.product.skus.data[0];
    },
  },
  methods: {
    add(ev) {
      this.store.addToCart(this.selected, this.quantity);
    }
  }
};

const ProductListItem = {
  name: "product-list-item",
  template: `
  <router-link :to="{path: link}">
    <div class="product">
      <div class="metadata">
        <div class="name">{{product.name}}</div>
        <div class="caption">{{product.caption}}</div>
      </div>

      <div class="thumb"><img :src="product.images[0]"></div>

      <div class="price">
        <span v-if="product.skus.data.length > 1 && price[0] != price[1]">
          \${{price[0] | dollars}} - \${{price[1] | dollars}}
        </span>
        <span v-else>\${{price[0] | dollars}}</span>
      </div>
    </div>
  </router-link>
  `,
  filters,
  props: ["product"],
  computed: {
    price() {
      let prices = this.product.skus.data.map(({price}) => price);
      return [Math.min(...prices), Math.max(...prices)];
    },
    link() {
      return `/products/${this.product.id}`;
    }
  }
};

const ProductList = {
  name: "product-list",
  template: `
  <div class="product-list">
    <product-list-item :product="product" v-for="(product, id) in store.products">
    </product-list-item>
  </div>
  `,
  components: {ProductListItem},
  data() {
    return {store}
  },
  mounted() {
    this.store.load();
  }
};

const ShoppingCart = {
  name: "shopping-cart",
  template: `
  <div class="cart">
    <h2>Products in Cart</h2>

    <table>
      <tr v-for="(item, key) in store.cart">
        <td>
          <div class="name" v-text="item.product.name"></div>
          <router-link class="caption" :to="'/products/' + item.product.id" v-text="item.product.caption">
          </router-link>
          <product-attributes :sku="item.sku"></product-attributes>
        </td>
        <td class="price">{{item.sku.price | dollars}}</td>
        <td><input class="quantity" type="number" v-model="item.quantity"></td>
        <td class="price">\${{item.sku.price * item.quantity | dollars}}</td>
        <td><i @click="store.removeFromCart(item.sku)" class="icon ion-android-close"></td>
      </tr>
    </table>

    <router-link to="/cart/checkout"><button>Checkout</button></router-link>
  </div>
  `,
  filters,
  components: {ProductAttributes},
  data() {
    return {store}
  }
};

const ShoppingCheckout = {
  name: "shopping-checkout",
  template: `
  <div class="checkout">
    <h2>Checkout</h2>

    <h3>Billing Information</h3>

    <table class="form">
      <tr><td>Name:</td><td><input type="text"></td></tr>
      <tr><td>Email:</td><td><input type="text" v-model="email"></td></tr>
      <tr><td>Card:</td><td><div class="card" ref="card"></div></td></tr>
    </table>

    <h3>Shipping Information</h3>

    <table class="form">
      <tr><td>Name:</td><td><input type="text" v-model="shipping.name"></td></tr>
      <tr><td>Address:</td><td><input type="text" v-model="shipping.address.line1"></td></tr>
      <tr><td>City:</td><td><input type="text" v-model="shipping.address.city"></td></tr>
      <tr><td>Country:</td><td><input type="text" v-model="shipping.address.country"></td></tr>
      <tr><td>Zip:</td><td><input type="text" v-model="shipping.address.postal_code"></td></tr>
    </table>

    <button @click="buy">Complete Purchase</button>
  </div>
  `,
  filters,
  data() {
    return {
      store,
      shipping: {
        address: {}
      },
      email: null
    }
  },
  mounted() {
    cardField.mount(this.$refs.card);
  },
  beforeDestroy() {
    cardField.unmount();
  },
  methods: {
    async buy() {
      try {
        let source = await stripe.createToken(cardField);
        let result = await this.store.purchase(source.token.id, this.shipping, this.email);
        console.log("Response:", await result.json());
      }
      catch (err) {
        console.log("Failed:", err);
      }
    }
  }
};

let App = new Vue({
  el: "#app",
  template: `
  <div id="app">
    <header>
      <h1><router-link to="/products">Example Shop</router-link></h1>

      <router-link class="cart-icon" to="/cart">
        <i class="icon ion-ios-cart"></i>
        <div class="marker" v-text="cartSize" v-show="cartSize > 0"></div>
      </router-link>
    </header>
    <router-view></router-view>
  </div>
  `,
  data() {
    return {store}
  },
  computed: {
    cartSize() {
      return Object.values(this.store.cart)
                   .reduce((total, {quantity}) => total + quantity, 0);
    }
  },
  router: new VueRouter({
    mode: "history",
    routes: [
      {path: "/", component: ProductList},
      {path: "/products", component: ProductList},
      {path: "/products/:id", component: ProductDetails},
      {path: "/cart", component: ShoppingCart},
      {path: "/cart/checkout", component: ShoppingCheckout}
    ]
  })
});
