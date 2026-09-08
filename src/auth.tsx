import {createContext,useContext,useState} from 'react';
import {authService,type SessionUser,type Role} from './services/auth.service';

type RegisterInput=Parameters<typeof authService.register>[0];
type AuthContextValue={user:SessionUser|null;loading:boolean;login:(email:string,password:string)=>Promise<SessionUser>;register:(input:RegisterInput)=>Promise<SessionUser>;logout:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|null>(null);

export function AuthProvider({children}:{children:React.ReactNode}){
  const[user,setUser]=useState<SessionUser|null>(null);
  const loading=false;
  const login=async(email:string,password:string)=>{const result=await authService.login(email,password);setUser(result.user);return result.user};
  const register=async(input:RegisterInput)=>{const result=await authService.register(input);setUser(result.user);return result.user};
  const logout=async()=>{await authService.logout();setUser(null)};
  return <AuthContext.Provider value={{user,loading,login,register,logout}}>{children}</AuthContext.Provider>;
}

export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value};

export function ProtectedRoute({children}:{roles:Role[];children:React.ReactNode}){return children}
