import {createContext,useContext,useEffect,useState} from 'react';
import {authService,type Role,type SessionUser} from './services/auth.service';

type RegisterInput=Parameters<typeof authService.register>[0];
type AuthContextValue={user:SessionUser|null;workspaces:Role[];loading:boolean;login:(email:string,password:string)=>Promise<SessionUser>;register:(input:RegisterInput)=>Promise<SessionUser>;chooseWorkspace:(role:Role)=>Promise<SessionUser>;logout:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|null>(null);

export function AuthProvider({children}:{children:React.ReactNode}){
  const[user,setUser]=useState<SessionUser|null>(null);
  const[workspaces,setWorkspaces]=useState<Role[]>([]);
  const[loading,setLoading]=useState(true);
  const keep=(session:{user:SessionUser;workspaces:Role[]})=>{setUser(session.user);setWorkspaces(session.workspaces);return session.user};
  // Restore an existing session on load so a refresh doesn't sign you out.
  useEffect(()=>{let live=true;authService.me().then(session=>{if(live)keep(session)}).catch(()=>{if(live)setUser(null)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
  const login=async(email:string,password:string)=>keep(await authService.login(email,password));
  const register=async(input:RegisterInput)=>keep(await authService.register(input));
  const chooseWorkspace=async(role:Role)=>keep(await authService.chooseWorkspace(role));
  const logout=async()=>{await authService.logout();setUser(null);setWorkspaces([])};
  return <AuthContext.Provider value={{user,workspaces,loading,login,register,chooseWorkspace,logout}}>{children}</AuthContext.Provider>;
}

/** Where a signed-in user lands after login, and where the nav's workspace link points.
    Without an active workspace they pick one first. */
export const workspacePath=(role:Role|null)=>role==='STUDENT'?'/student/dashboard':role==='TUTOR'?'/tutor/dashboard':role==='ORGANIZATION'?'/org/dashboard':role==='ADMIN'?'/admin':'/choose-workspace';

export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value};

export function ProtectedRoute({children}:{roles:Role[];children:React.ReactNode}){return children}
