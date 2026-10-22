"use client";

import { useRef, useState } from "react";

export const galleryPhotos = product => product?.images?.length ? product.images : (product?.image ? [product.image] : []);

export default function ProductGallery({ product }) {
  const images = galleryPhotos(product);
  const [active,setActive] = useState(0);
  const list = useRef(null);
  const go = n => {
    const next = Math.min(images.length-1,Math.max(0,n));
    if (list.current) list.current.scrollTo({left:next*list.current.clientWidth,behavior:"smooth"});
    setActive(next);
  };
  return <div className="product-gallery" aria-label={product.name+" photos"} key={product.id}>
    <div className="product-gallery-stage">
      <div className="product-gallery-track" ref={list} onScroll={e=>{
        const el=e.currentTarget;
        setActive(Math.max(0,Math.min(images.length-1,Math.round(el.scrollLeft/Math.max(1,el.clientWidth)))));
      }}>
        {images.map((src,i)=><div className="product-gallery-slide" key={src}>
          <img src={src} alt={product.name+" – photo "+(i+1)+" of "+images.length} loading={i?"lazy":"eager"}/>
        </div>)}
      </div>
      {images.length>1 && <>
        <button className="product-gallery-arrow previous" type="button" onClick={()=>go(active-1)} disabled={active===0} aria-label="Previous cake photo">‹</button>
        <button className="product-gallery-arrow next" type="button" onClick={()=>go(active+1)} disabled={active===images.length-1} aria-label="Next cake photo">›</button>
        <span className="product-gallery-counter">{active+1} / {images.length}</span>
      </>}
    </div>
    {images.length>1 && <div className="product-gallery-thumbs" aria-label="Choose cake photo">
      {images.map((src,i)=><button type="button" className={i===active?"active":""} key={src} onClick={()=>go(i)} aria-label={"Show photo "+(i+1)} aria-current={i===active?"true":undefined}><img loading="lazy" src={src} alt=""/></button>)}
    </div>}
    <p className="photo-footnote">Swipe to see different views. Cake colours and decoration can vary slightly.</p>
  </div>;
}
