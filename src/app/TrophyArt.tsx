import type {Competition} from '../game-core/competitions';

const artwork = new Set([
 'moba_world','cs_major','cs_interregional','cs_cologne','cs_league',
 'cblol','lcs','lec','lck','lpl','lcp','br_cup','na_cup','cs_regional',
]);

export function TrophyArt({event}:{event:Pick<Competition,'key'|'prestige'|'name'>}){
 const asset=artwork.has(event.key)?event.key:'access';
 return <img className="trophy-art" src={`${import.meta.env.BASE_URL}assets/trophies/${asset}.jpg`}
   alt={'Troféu de '+event.name} width={508} height={508} loading="lazy" decoding="async"/>;
}
