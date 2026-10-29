"use client";
import { unitPrice, money, approvedWeightsKg } from "@cake-galaxy/catalog";
import { safeCakeImage } from "./salesAssistant.mjs";
import styles from "./SmartChat.module.css";

export function CategoryPicker({categories,onSelect,disabled}){
 if(!categories?.length)return <p>No cakes are available at the moment. Please contact Cake Galaxy.</p>;
 return <div className={styles.categoryGrid} role="group" aria-label="Choose a cake category">
   {categories.map(category=><button key={category.name} type="button" className={styles.categoryTile}
     disabled={disabled} onClick={()=>onSelect(category.name)}>
     <img src={safeCakeImage(category.image)} alt="" loading="lazy"/>
     <span><strong>{category.name}</strong><small>{category.count} {category.count===1?"cake":"cakes"}</small></span>
   </button>)}
 </div>;
}

export function CakeFlatList({products,onSelect,disabled}){
 if(!products?.length)return <p>No available cakes in this category.</p>;
 return <div className={styles.cakeFlatList} role="group" aria-label="Available cakes">
   {products.map(product=>{
     const size=product.unit==="kg" ? product.weights.find(w=>approvedWeightsKg.includes(w)) : product.weights?.[0];
     const price=unitPrice({productId:product.id,size,eggless:false,addons:[]},product);
     return <button key={product.id} type="button" className={styles.cakeFlatItem} disabled={disabled} onClick={()=>onSelect(product.id)}>
       <img src={safeCakeImage(product.images?.[0]||product.image)} alt={product.name} loading="lazy"/>
       <span className={styles.cakeFlatInfo}><strong>{product.name}</strong><small>{price>0?"From "+money(price):"Choose to see options"}</small></span>
       <span className={styles.cakeFlatArrow} aria-hidden="true">›</span>
     </button>;
   })}
 </div>;
}
