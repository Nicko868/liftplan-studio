import numpy as np, cv2, json, sys
from skimage.morphology import skeletonize
from scipy.spatial import cKDTree
S=0.4016; O=(1286,1323); K=3; T=int(sys.argv[1]); MINC=int(sys.argv[2]); SPUR=float(sys.argv[3]); GAP=float(sys.argv[4]); EPS=float(sys.argv[5])
im=cv2.imread('../lng/plotplan.png', cv2.IMREAD_GRAYSCALE)
g=cv2.resize(im,None,fx=K,fy=K,interpolation=cv2.INTER_CUBIC)
ink=(g<T).astype(np.uint8); ink=cv2.morphologyEx(ink,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
n,lab,st,_=cv2.connectedComponentsWithStats(ink,8)
keep=np.zeros(n,bool); keep[1:]=np.maximum(st[1:,2],st[1:,3])>=MINC
ink=keep[lab].astype(np.uint8)
sk=skeletonize(ink>0)
ys,xs=np.nonzero(sk); P=set(zip(ys.tolist(),xs.tolist()))
nb=[(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
def neigh(p): y,x=p; return [(y+dy,x+dx) for dy,dx in nb if (y+dy,x+dx) in P]
deg={p:len(neigh(p)) for p in P}; nodes={p for p,d in deg.items() if d!=2}
used=set(); ek=lambda a,b:(a,b) if a<b else (b,a); paths=[]
def walk(s,q,stop):
    line=[s,q]; used.add(ek(s,q)); prev,cur=s,q
    while not stop(cur):
        nx=[r for r in neigh(cur) if r!=prev and ek(cur,r) not in used]
        if not nx: break
        r=nx[0]; used.add(ek(cur,r)); line.append(r); prev,cur=cur,r
    return line
for s in nodes:
    for q in neigh(s):
        if ek(s,q) not in used: paths.append(walk(s,q,lambda c:c in nodes))
for p in list(P):
    for q in neigh(p):
        if ek(p,q) not in used: paths.append(walk(p,q,lambda c:False))
# spur pruning: short branches ending free, attached to a junction
def plen(L): return sum(np.hypot(L[i+1][0]-L[i][0],L[i+1][1]-L[i][1]) for i in range(len(L)-1))
keepP=[]
for L in paths:
    a,b=L[0],L[-1]; da,db=deg.get(a,2),deg.get(b,2)
    if ((da==1 and db>=3) or (db==1 and da>=3)) and plen(L)<SPUR: continue
    keepP.append(L)
paths=keepP
# polylines in 1x px (x,y)
pl=[np.array([[x/K,y/K] for y,x in L],np.float32) for L in paths]
pl=[p for p in pl if len(p)>1 and np.sum(np.hypot(*np.diff(p,axis=0).T))>=1.5]
# gap bridging between free ends
ends=[]; 
for i,p in enumerate(pl):
    for j,e in ((0,p[0]),(1,p[-1])): ends.append((i,j,e))
E=np.array([e for _,_,e in ends]); tr=cKDTree(E); bridges=[]; usedE=set()
for k,(i,j,e) in enumerate(ends):
    if k in usedE: continue
    for m in tr.query_ball_point(e,GAP):
        if m==k or m in usedE or ends[m][0]==i: continue
        bridges.append(np.array([e,ends[m][2]],np.float32)); usedE.add(k); usedE.add(m); break
pl+=bridges
out=[]; npts=0
for p in pl:
    s=cv2.approxPolyDP(p.reshape(-1,1,2),EPS,False).reshape(-1,2)
    pts=[]
    for x,y in s: pts+=[round(float((x+0.5/K-O[0])*S),2), round(float(-(y+0.5/K-O[1])*S),2)]
    out.append({"p":pts}); npts+=len(s)
xs=[v for q in out for v in q["p"][0::2]]; ys=[v for q in out for v in q["p"][1::2]]
json.dump({"paths":out,"texts":[],"bbox":[min(xs),min(ys),max(xs),max(ys)],"traced":True},open('skel.json','w'),separators=(',',':'))
print(len(out),npts,len(bridges))
x0,y0,x1,y1=1080,1220,1520,1420
d=""
for q in out:
    p=q["p"]; d+="M"+" L".join(f"{p[i]:.2f} {-p[i+1]:.2f}" for i in range(0,len(p),2))
wx0=(x0-O[0])*S; wy0=(y0-O[1])*S; ww=(x1-x0)*S; wh=(y1-y0)*S
open('sk.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{(x1-x0)*2}" height="{(y1-y0)*2}" viewBox="{wx0} {wy0} {ww} {wh}"><rect x="{wx0}" y="{wy0}" width="{ww}" height="{wh}" fill="#fff"/><path d="{d}" fill="none" stroke="#333" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>')
