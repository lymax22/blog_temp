#!/usr/bin/env python3
import json, math, hashlib
from pathlib import Path
import numpy as np
from scipy.integrate import solve_ivp
from scipy.sparse import coo_matrix

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "scripts/fixtures/dt14_v1_reference.json"
OUT = ROOT / ".tmp-dt14-full-v1"
OUT.mkdir(exist_ok=True)

with FIXTURE.open("r", encoding="utf-8") as f:
    fixture = json.load(f)

tau = np.asarray(fixture["tau"], dtype=float)
Xref = np.asarray(fixture["state"], dtype=float).T
Uref = np.asarray(fixture["control"], dtype=float).T
sref = float(fixture["s"])
K = tau.size
N = K - 1
assert Xref.shape == (14, 41) and Uref.shape == (3, 41)

# dt14_params.m
Lr=40.9; Lo=Lr/3; Lp=Lr/2; Isp=282.; Sref_phys=10.52; Cd=.5
J_phys=np.array([6.26e4,6.98e6,6.98e6]); Tmin_phys=302.4e3; Tmax_phys=756e3
m0=46800.; mDry=36000.; g0_phys=9.807; muEarth=3.986012e14; REarth=6378.145e3
rho0_phys=1.225; Hs_phys=7200.; omegaMax_phys=np.deg2rad(20); gimbalMax=np.deg2rad(10)
thetaMin=np.deg2rad(60); quatNormTol=1e-3
r0=np.array([-600.,7200.,500.]); rf=np.array([0.,Lo,0.]); v0B=np.array([-300.,-65.,-40.])
omega0=np.deg2rad([0.,-3.,-2.]); q0pub=np.array([.8156,.0570,.0038,.5758]); q0=q0pub/np.linalg.norm(q0pub)
scale_length=7200.; scale_speed=350.; scale_time=scale_length/scale_speed
scale_acc=scale_speed/scale_time; scale_ang=1/scale_time; scale_mass=m0
scale_force=scale_mass*scale_acc; scale_area=scale_length**2; scale_volume=scale_length**3
scale_density=scale_mass/scale_volume; scale_inertia=scale_mass*scale_length**2
p={}
p["Lo"]=Lo/scale_length; p["Lp"]=Lp/scale_length; p["Isp"]=Isp/scale_time
p["Sref"]=Sref_phys/scale_area; p["Cd"]=Cd; p["J"]=J_phys/scale_inertia
p["Tmin"]=Tmin_phys/scale_force; p["Tmax"]=Tmax_phys/scale_force
p["m0"]=1.; p["mDry"]=mDry/m0; p["g0"]=g0_phys/scale_acc
p["muEarth"]=muEarth/(scale_acc*scale_length**2); p["REarth"]=REarth/scale_length
p["rho0"]=rho0_phys/scale_density; p["Hs"]=Hs_phys/scale_length
p["omegaMax"]=omegaMax_phys/scale_ang; p["gimbalMax"]=gimbalMax; p["thetaMin"]=thetaMin
p["quatNormTol"]=quatNormTol

def dcm(q):
    q0,q1,q2,q3=q
    return np.array([
      [1-2*q2*q2-2*q3*q3, 2*q1*q2-2*q0*q3, 2*q1*q3+2*q0*q2],
      [2*q1*q2+2*q0*q3, 1-2*q1*q1-2*q3*q3, 2*q2*q3-2*q0*q1],
      [2*q1*q3-2*q0*q2, 2*q2*q3+2*q0*q1, 1-2*q1*q1-2*q2*q2]
    ])

C0=dcm(q0)
v0E=C0@v0B
initial=np.r_[r0/scale_length,v0E/scale_speed,omega0/scale_ang,q0,1.]
terminal_pos=rf/scale_length
terminal_vel=np.zeros(3)
stateLower=np.r_[np.array([-2e4,Lo,-2e4])/scale_length,-700*np.ones(3)/scale_speed,
                 -p["omegaMax"]*np.ones(3),-np.ones(4),p["mDry"]]
stateUpper=np.r_[np.array([2e4,1.5e4,2e4])/scale_length,700*np.ones(3)/scale_speed,
                 p["omegaMax"]*np.ones(3),np.ones(4),p["m0"]]
sMin=15/scale_time; sMax=100/scale_time
wNu=1e4; wTR=.5

def skew(v):
    return np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]],float)

def dcm_derivs(q):
    q0,q1,q2,q3=q
    D=np.zeros((4,3,3))
    D[0]=[[0,-2*q3,2*q2],[2*q3,0,-2*q1],[-2*q2,2*q1,0]]
    D[1]=[[0,2*q2,2*q3],[2*q2,-4*q1,-2*q0],[2*q3,2*q0,-4*q1]]
    D[2]=[[-4*q2,2*q1,2*q0],[2*q1,0,2*q3],[-2*q0,2*q3,-4*q2]]
    D[3]=[[-4*q3,-2*q0,2*q1],[2*q0,-4*q3,2*q2],[2*q1,2*q2,0]]
    return D

def dynamics(x,u):
    r=x[:3]; v=x[3:6]; omg=x[6:9]; q=x[9:13]; mass=x[13]
    C=dcm(q); vB=C.T@v
    rho=p["rho0"]*np.exp(-max(r[1],0)/p["Hs"])
    sp=np.linalg.norm(vB)
    drag=-.5*p["Cd"]*p["Sref"]*rho*sp*vB
    gY=-p["muEarth"]/(p["REarth"]+r[1])**2
    rdot=v
    vdot=np.array([0,gY,0.])+C@(u+drag)/mass
    rT=np.array([-p["Lo"],0,0.]); rA=np.array([p["Lp"]-p["Lo"],0,0.])
    J=p["J"]; Jomg=J*omg
    odot=(np.cross(rT,u)+np.cross(rA,drag)-np.cross(omg,Jomg))/J
    wx,wy,wz=omg
    Omega=np.array([[0,-wx,-wy,-wz],[wx,0,wz,-wy],[wy,-wz,0,wx],[wz,wy,-wx,0]])
    qdot=.5*Omega@q
    mdot=-np.linalg.norm(u)/(p["Isp"]*p["g0"])
    return np.r_[rdot,vdot,odot,qdot,mdot]

def jacobian(x,u):
    r=x[:3]; v=x[3:6]; omg=x[6:9]; q=x[9:13]; mass=x[13]
    C=dcm(q); Cq=dcm_derivs(q); vB=C.T@v; speed=np.linalg.norm(vB)
    rho=p["rho0"]*np.exp(-max(r[1],0)/p["Hs"])
    dc=.5*p["Cd"]*p["Sref"]; drag=-dc*rho*speed*vB
    if speed > math.sqrt(np.finfo(float).eps):
        Jv=-dc*rho*(speed*np.eye(3)+np.outer(vB,vB)/speed)
    else: Jv=np.zeros((3,3))
    dDragDv=Jv@C.T
    dDragDq=np.column_stack([Jv@(Cq[i].T@v) for i in range(4)])
    if r[1] > 0: dDragDy=-drag/p["Hs"]
    elif r[1] < 0: dDragDy=np.zeros(3)
    else: raise RuntimeError("atmosphere nonsmooth")
    A=np.zeros((14,14)); B=np.zeros((14,3))
    A[:3,3:6]=np.eye(3)
    body=u+drag
    A[3:6,1]=np.array([0,2*p["muEarth"]/(p["REarth"]+r[1])**3,0])+C@dDragDy/mass
    A[3:6,3:6]=C@dDragDv/mass
    for i in range(4):
        A[3:6,9+i]=(Cq[i]@body+C@dDragDq[:,i])/mass
    A[3:6,13]=-C@body/mass**2
    B[3:6]=C/mass
    rT=np.array([-p["Lo"],0,0.]); rA=np.array([p["Lp"]-p["Lo"],0,0.]); Jdiag=np.diag(p["J"])
    A[6:9,1]=np.linalg.solve(Jdiag,skew(rA)@dDragDy)
    A[6:9,3:6]=np.linalg.solve(Jdiag,skew(rA)@dDragDv)
    A[6:9,6:9]=np.linalg.solve(Jdiag,skew(p["J"]*omg)-skew(omg)@Jdiag)
    for i in range(4): A[6:9,9+i]=np.linalg.solve(Jdiag,skew(rA)@dDragDq[:,i])
    B[6:9]=np.linalg.solve(Jdiag,skew(rT))
    wx,wy,wz=omg
    Omega=np.array([[0,-wx,-wy,-wz],[wx,0,wz,-wy],[wy,-wz,0,wx],[wz,wy,-wx,0]])
    A[9:13,6:9]=.5*np.array([[-q[1],-q[2],-q[3]],[q[0],-q[3],q[2]],[q[3],q[0],-q[1]],[-q[2],q[1],q[0]]])
    A[9:13,9:13]=.5*Omega
    B[13,:]=-u/(np.linalg.norm(u)*p["Isp"]*p["g0"])
    return A,B

def foh(t,t0,t1,u0,u1):
    lp=(t-t0)/(t1-t0); lm=1-lp
    return lm*u0+lp*u1,lm,lp

disc=[]
closure=[]
for k in range(N):
    t0,t1=tau[k],tau[k+1]; u0,u1=Uref[:,k],Uref[:,k+1]
    def rhs_state(t,x):
        u,_,_=foh(t,t0,t1,u0,u1)
        return sref*dynamics(x,u)
    solx=solve_ivp(rhs_state,(t0,t1),Xref[:,k],method="DOP853",rtol=2e-12,atol=2e-13,dense_output=True)
    closure.append(np.max(np.abs(solx.y[:,-1]-Xref[:,k+1])))
    y0=np.r_[np.eye(14).ravel(order="F"),np.zeros(14*3*2+14*2)]
    def rhs_aug(t,y):
        off=0
        Phi=y[off:off+196].reshape((14,14),order="F"); off+=196
        Gm=y[off:off+42].reshape((14,3),order="F"); off+=42
        Gp=y[off:off+42].reshape((14,3),order="F"); off+=42
        Gs=y[off:off+14]; off+=14
        Gw=y[off:off+14]
        x=solx.sol(t); u,lm,lp=foh(t,t0,t1,u0,u1)
        dfdx,dfdu=jacobian(x,u); f=dynamics(x,u)
        AA=sref*dfdx; BB=sref*dfdu; SS=f; ww=-AA@x-BB@u
        return np.r_[(AA@Phi).ravel(order="F"),(AA@Gm+BB*lm).ravel(order="F"),
                     (AA@Gp+BB*lp).ravel(order="F"),AA@Gs+SS,AA@Gw+ww]
    sola=solve_ivp(rhs_aug,(t0,t1),y0,method="DOP853",rtol=2e-11,atol=2e-13)
    y=sola.y[:,-1]; off=0
    AA=y[off:off+196].reshape((14,14),order="F"); off+=196
    Bm=y[off:off+42].reshape((14,3),order="F"); off+=42
    Bp=y[off:off+42].reshape((14,3),order="F"); off+=42
    SS=y[off:off+14]; off+=14
    ww=y[off:off+14]
    disc.append((AA,Bm,Bp,SS,ww))

# Variable layout: X, U, s, Nu, absNu, trEpigraph
nx=14*K; nu=3*K; ns=1; nn=14*N; na=nn; nr=1
ix0=0; iu0=nx; is0=iu0+nu; inu0=is0+1; ia0=inu0+nn; ir=ia0+na
nvar=ir+1
def ix(i,k): return ix0+k*14+i
def iu(i,k): return iu0+k*3+i
def inu(i,k): return inu0+k*14+i
def ia(i,k): return ia0+k*14+i

eq_rows=[]; eq_cols=[]; eq_vals=[]; b=[]
def add_eq(coeff,rhs):
    row=len(b); b.append(float(rhs))
    for j,v in coeff.items():
        if v: eq_rows.append(row); eq_cols.append(j); eq_vals.append(float(v))

g_rows=[]; g_cols=[]; g_vals=[]; h=[]; qcones=[]
def add_lin(coeff,rhs):
    row=len(h); h.append(float(rhs))
    for j,v in coeff.items():
        if v: g_rows.append(row); g_cols.append(j); g_vals.append(float(v))
def add_soc(rows):
    start=len(h)
    for coeff,rhs in rows:
        row=len(h); h.append(float(rhs))
        for j,v in coeff.items():
            if v: g_rows.append(row); g_cols.append(j); g_vals.append(float(v))
    qcones.append(len(rows))

# Equalities
for i in range(14): add_eq({ix(i,0):1},initial[i])
for k,(AA,Bm,Bp,SS,ww) in enumerate(disc):
    for i in range(14):
        c={ix(i,k+1):1, is0:-SS[i], inu(i,k):-1}
        for j in range(14): c[ix(j,k)]=c.get(ix(j,k),0)-AA[i,j]
        for j in range(3):
            c[iu(j,k)]=c.get(iu(j,k),0)-Bm[i,j]
            c[iu(j,k+1)]=c.get(iu(j,k+1),0)-Bp[i,j]
        add_eq(c,ww[i])
for i in range(3): add_eq({ix(i,K-1):1},terminal_pos[i])
for i in range(3): add_eq({ix(3+i,K-1):1},terminal_vel[i])
add_eq({ix(9,K-1):1,ix(12,K-1):-1},0)
add_eq({ix(10,K-1):1,ix(11,K-1):-1},0)

# Linear inequalities
add_lin({is0:-1},-sMin)
add_lin({is0:1},sMax)
for k in range(K):
    for i in range(14):
        add_lin({ix(i,k):-1},-stateLower[i])
        add_lin({ix(i,k):1},stateUpper[i])
    add_lin({iu(0,k):-1},0)
    d=Uref[:,k]/np.linalg.norm(Uref[:,k])
    add_lin({iu(j,k):-d[j] for j in range(3)},-p["Tmin"])
    q=Xref[9:13,k]; grad=2*q; off=(1-p["quatNormTol"])+q@q
    add_lin({ix(9+j,k):-grad[j] for j in range(4)},-off)
    q0r,q1r,q2r,q3r=q
    thgrad=-2*np.array([q3r,q2r,q1r,q0r])
    refval=np.sin(p["thetaMin"])-2*(q1r*q2r+q0r*q3r)
    thoff=refval-thgrad@q
    add_lin({ix(9+j,k):thgrad[j] for j in range(4)},-thoff)
# terminal lower qnorm
q=Xref[9:13,-1]; grad=2*q; off=1+q@q
add_lin({ix(9+j,K-1):-grad[j] for j in range(4)},-off)
# abs Nu
for k in range(N):
    for i in range(14):
        add_lin({inu(i,k):1,ia(i,k):-1},0)
        add_lin({inu(i,k):-1,ia(i,k):-1},0)

lcount=len(h)

# SOCs: Tmax, gimbal, path q upper at each node
cg=math.cos(p["gimbalMax"])
for k in range(K):
    add_soc([({},p["Tmax"])]+[({iu(j,k):-1},0) for j in range(3)])
    add_soc([({iu(0,k):-1},0)]+[({iu(j,k):-cg},0) for j in range(3)])
    radius=math.sqrt(1+p["quatNormTol"])
    add_soc([({},radius)]+[({ix(9+j,k):-1},0) for j in range(4)])
# terminal q upper
add_soc([({},1)]+[({ix(9+j,K-1):-1},0) for j in range(4)])
# quadratic trust region epigraph: r >= ||[X-Xref,U-Uref,s-sref]||^2
rows=[({ir:-1},1)]
for k in range(K):
    for i in range(14): rows.append(({ix(i,k):-2},-2*Xref[i,k]))
for k in range(K):
    for i in range(3): rows.append(({iu(i,k):-2},-2*Uref[i,k]))
rows.append(({is0:-2},-2*sref))
rows.append(({ir:-1},-1))
add_soc(rows)

A=coo_matrix((eq_vals,(eq_rows,eq_cols)),shape=(len(b),nvar)).tocsc()
G=coo_matrix((g_vals,(g_rows,g_cols)),shape=(len(h),nvar)).tocsc()
c=np.zeros(nvar); c[ix(13,K-1)]=-1
for k in range(N):
    for i in range(14): c[ia(i,k)]=wNu
c[ir]=wTR

def csc_obj(M):
    return {"format":"csc","rows":M.shape[0],"cols":M.shape[1],
            "values":M.data.tolist(),"colPointers":M.indptr.tolist(),"rowIndices":M.indices.tolist()}

problem={"c":c.tolist(),"G":csc_obj(G),"h":h,"A":csc_obj(A),"b":b,
         "cones":{"l":lcount,"q":qcones,"nex":0}}
meta={
  "provenance":fixture["provenance"],
  "formulation":"DT14_FREE_TF_CONVEX_SUBPROBLEM_V1_FULL_CANONICAL",
  "n":nvar,"m":G.shape[0],"p":A.shape[0],"nnzG":G.nnz,"nnzA":A.nnz,
  "linearCone":lcount,"socCount":len(qcones),"socDimensions":qcones,
  "referenceClosureMaxDop853":float(max(closure)),
  "expectedHistoricalStatus":"Infeasible",
  "historicalTerminalIntersectionGap":0.00478119016790435,
  "originalDecisionCount":nx+nu+1+nn,
  "auxAbsCount":na,"auxTrustEpigraphCount":1
}
(OUT/"problem.json").write_text(json.dumps(problem,separators=(",",":")),encoding="utf-8")
(OUT/"meta.json").write_text(json.dumps(meta,indent=2)+"\n",encoding="utf-8")
print(json.dumps(meta,indent=2))
