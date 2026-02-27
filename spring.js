function springPetals(){
  for(let i=0;i<15;i++){
    const p=document.createElement("div");
    p.className="petal";
    p.innerText="🌸";
    p.style.left=Math.random()*100+"vw";
    p.style.animationDuration=(6+Math.random()*6)+"s";
    p.style.fontSize=(14+Math.random()*10)+"px";
    document.body.appendChild(p);
  }
}
springPetals();