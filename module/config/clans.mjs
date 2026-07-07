/**
 * Naruto RPG - Dados de Clas (Cap. 8 base + Cap. 2 Expansao).
 * Gerado a partir do PWA NarutoRPG_CharacterCreator (CLA_BASE/CLA_EXPANSAO/CLA_DESC + campo clan dos jutsus).
 * CLANS: lista selecionavel com descricao. JUTSU_CLAN: sourceId do jutsu -> nome do cla exigido (gate).
 */

export const CLANS = [
  {
    "name": "Uchiha",
    "expansion": false,
    "emoji": "🔥",
    "vila": "Konoha",
    "req": "Clã Notável 5 (Doujutsu) para o Sharingan",
    "texto": "Um dos clãs mais poderosos e trágicos de Konoha. Possuem o Sharingan, um dōjutsu (poder ocular) que copia técnicas e prevê movimentos. Mestres natos do elemento Fogo."
  },
  {
    "name": "Hyuuga",
    "expansion": false,
    "emoji": "👁️",
    "vila": "Konoha",
    "req": "Clã Notável 5 (Doujutsu) para o Byakugan",
    "texto": "Clã nobre detentor do Byakugan, olhos que enxergam em 360°, veem através de objetos e revelam o fluxo de chakra. Lutam com o Juuken (Punho Gentil), atacando os pontos vitais internos do oponente."
  },
  {
    "name": "Nara",
    "expansion": false,
    "emoji": "🌑",
    "vila": "Konoha",
    "req": "Clã Notável 3 (técnicas exclusivas)",
    "texto": "Estrategistas geniais que manipulam as próprias sombras para imobilizar e controlar inimigos à distância. Preguiçosos por fora, mentes brilhantes por dentro."
  },
  {
    "name": "Akimichi",
    "expansion": false,
    "emoji": "💪",
    "vila": "Konoha",
    "req": "Clã Notável 3 (técnicas exclusivas)",
    "texto": "Guerreiros de grande porte que convertem calorias em chakra para expandir partes do corpo a tamanhos gigantescos. Leais, gentis e devastadores em combate corpo a corpo."
  },
  {
    "name": "Yamanaka",
    "expansion": false,
    "emoji": "🧠",
    "vila": "Konoha",
    "req": "Clã Notável 3 (técnicas exclusivas)",
    "texto": "Especialistas em técnicas mentais: invadem e assumem o controle da mente alheia, transmitem pensamentos e atuam na inteligência e interrogatório da vila."
  },
  {
    "name": "Aburame",
    "expansion": false,
    "emoji": "🐛",
    "vila": "Konoha",
    "req": "Clã Notável 3 (técnicas exclusivas)",
    "texto": "Hospedam colônias de insetos especiais (kikaichu) dentro do próprio corpo desde o nascimento. Os insetos drenam o chakra do inimigo e servem de rastreadores silenciosos."
  },
  {
    "name": "Inuzuka",
    "expansion": false,
    "emoji": "🐺",
    "vila": "Konoha",
    "req": "Clã Notável 3 + Mascote 3 (cão ninja)",
    "texto": "Lutam em parceria com cães ninja (ninken), sincronizando ataques ferozes. Sentidos animalescos aguçados, sobretudo olfato. Selvagens, leais e instintivos."
  },
  {
    "name": "Sarutobi",
    "expansion": false,
    "emoji": "🍃",
    "vila": "Konoha",
    "req": "Clã Notável 3 (recomendado)",
    "texto": "Clã versátil e respeitado, que já deu Hokages à vila. Sem um Kekkei Genkai único, brilham pela maestria ampla em Ninjutsu e dedicação à Folha."
  },
  {
    "name": "Hatake",
    "expansion": false,
    "emoji": "⚡",
    "vila": "Konoha",
    "req": "Clã Notável 3 (recomendado)",
    "texto": "Pequeno clã de gênios solitários, célebre por Kakashi, o Ninja Copiador. Conhecidos por habilidade excepcional e pela técnica de raio Chidori."
  },
  {
    "name": "Uzumaki",
    "expansion": true,
    "emoji": "🌀",
    "vila": "Redemoinho / Konoha",
    "req": "Clã Notável 3 · Sensei 1 recomendado",
    "texto": "Clã de imensa vitalidade e reservas de chakra colossais, aparentado dos Senju. Mestres do Fuinjutsu (a arte dos selos). Sua vila natal, Uzushiogakure, foi destruída por ser temida."
  },
  {
    "name": "Yuki",
    "expansion": true,
    "emoji": "❄️",
    "vila": "Kirigakure",
    "req": "Clã Notável 4 · Afinidade Água + Vento",
    "texto": "Portadores do raro Kekkei Genkai Hyoton (Gelo), que combina Água e Vento para criar gelo a partir do nada. Quase exterminados nas perseguições da Névoa — Haku foi um dos últimos."
  },
  {
    "name": "Kaguya",
    "expansion": true,
    "emoji": "🦴",
    "vila": "Kirigakure",
    "req": "Clã Notável 5 (Doujutsu corporal)",
    "texto": "Clã guerreiro de fisiologia única: o Shikotsumyaku permite manipular, endurecer e projetar os próprios ossos como armas e armadura. Ferozes e orgulhosos do combate."
  },
  {
    "name": "Hozuki",
    "expansion": true,
    "emoji": "💧",
    "vila": "Kirigakure",
    "req": "Clã Notável 4 · Afinidade Água",
    "texto": "Capazes de liquefazer o próprio corpo em água, tornando-se intangíveis a ataques físicos. Mais fortes perto de grandes massas de água. Clã de Suigetsu."
  },
  {
    "name": "Terumi",
    "expansion": true,
    "emoji": "🌋",
    "vila": "Kirigakure",
    "req": "Clã Notável 4 · Afinidade dupla (Fogo+Água ou Fogo+Terra)",
    "texto": "Linhagem raríssima que pode manifestar dois Kekkei Genkai: Yoton (Lava) e Futton (Vapor Ácido). Mei Terumi, a Quinta Mizukage, é o exemplo máximo."
  },
  {
    "name": "Linhagem Kazekage",
    "expansion": true,
    "emoji": "🧲",
    "vila": "Sunagakure",
    "req": "Clã Notável 4 · Afinidade Terra",
    "texto": "Linhagem recorrente na família dos Kazekages. O Jiton (Liberação Magnética) magnetiza o chakra para controlar metais e areia com precisão cirúrgica. O caso de Gaara é amplificado pelo Bijuu Shukaku."
  },
  {
    "name": "Fuuma",
    "expansion": true,
    "emoji": "🌪️",
    "vila": "País do Fogo / Chuva",
    "req": "Clã Notável 3 · alto nível em Arremesso",
    "texto": "Clã agressivo e ambicioso, criador e maior especialista das gigantescas Fuuma Shuriken de quatro lâminas. Prodígios natos do combate à distância."
  },
  {
    "name": "Hoshigaki",
    "expansion": true,
    "emoji": "🦈",
    "vila": "Kirigakure",
    "req": "Clã Notável 3 · Afinidade Água",
    "texto": "Membros com traços de tubarão — dentes afiados, guelras, reservas de chakra vastíssimas. Mestres do Suiton e mortais perto da água. Clã de Kisame, portador da Samehada."
  },
  {
    "name": "Yotsuki",
    "expansion": true,
    "emoji": "☁️",
    "vila": "Kumogakure",
    "req": "Clã Notável 3 · alto nível em Armas Brancas",
    "texto": "Clã da Nuvem famoso pela lealdade inabalável — nunca traem nem entregam aliados — e por uma esgrima sem igual. Guardiões do treino do jinchuuriki do Hachibi."
  },
  {
    "name": "Shimura",
    "expansion": true,
    "emoji": "🍃",
    "vila": "Konoha",
    "req": "Clã Notável 3 · Afinidade Vento",
    "texto": "Um dos clãs fundadores da Folha, ao lado de Senju e Uchiha. Combatentes excepcionais, mestres do Fuuton (vento que corta defesas) e de técnicas de selamento próprias. Clã de Danzo."
  },
  {
    "name": "Senju",
    "expansion": true,
    "emoji": "🌳",
    "vila": "Konoha",
    "req": "Clã Notável 4 (Mokuton: Clã Notável 5)",
    "texto": "Clã lendário co-fundador de Konoha, descendente do Sábio dos Seis Caminhos. Vitalidade e chakra extraordinários; deu origem ao Mokuton (Madeira) de Hashirama, o Primeiro Hokage."
  },
  {
    "name": "Namikaze",
    "expansion": true,
    "emoji": "💨",
    "vila": "Konoha",
    "req": "Clã Notável 3 (recomendado)",
    "texto": "Linhagem rara e veloz, eternizada por Minato, o Quarto Hokage — o 'Relâmpago Amarelo'. Equilíbrio notável entre chakra e força de vontade, e afinidade com técnicas de espaço-tempo."
  }
];

/** sourceId do jutsu -> nome do cla que pode compra-lo (jutsus exclusivos de cla) */
export const JUTSU_CLAN = {
  "genjutsu_release_aburame_style_kai_no_genjutsu_aburame_ryu": "Aburame",
  "locate_female_kikkai_genshi_josei_kikkai": "Aburame",
  "kikkai_poisons_absorption_technique_kikkai_dokukeshi_no_jutsu": "Aburame",
  "kikkais_chakra_feast_technique_kikkai_chakra_kyouen_no_jutsu": "Aburame",
  "bug_clone_technique_mushi_bunshin_no_jutsu": "Aburame",
  "double_size_technique_baika_no_jutsu": "Akimichi",
  "mega_multi_size_technique_chou_baika_no_jutsu": "Akimichi",
  "meat_tank_nikudan_sensha": "Akimichi",
  "byakugan": "Hyuuga",
  "jyuuken_ryu": "Hyuuga",
  "sixty_four_palms_of_divination_hakke_rokujuuyon_shou": "Hyuuga",
  "divination_whirl_hakkeshou_kaiten": "Hyuuga",
  "extended_aerial_palm_of_divination_hakke_kuushou": "Hyuuga",
  "double_piercing_fang_gatsuuga": "Inuzuka",
  "human_beast_clone_jyuujin_bunshin": "Inuzuka",
  "exceptional_scent_tracking_kakudan_senro_nioi": "Inuzuka",
  "beast_imitation_technique_shikyaku_no_jutsu": "Inuzuka",
  "shadow_sewing_kage_nui": "Nara",
  "shadow_hand_technique_kage_kubi_shiabari_no_jutsu": "Nara",
  "shadow_imitation_technique_kage_mane_no_jutsu": "Nara",
  "sharingan_lv2": "Uchiha",
  "sharingan_lv3": "Uchiha",
  "mangekyu_sharingan": "Uchiha",
  "mind_transfer_technique_shintenshin_no_jutsu": "Yamanaka",
  "betrayal_technique_shinranshin_no_jutsu": "Yamanaka",
  "partial_multi_size_technique_bubun_baika_no_jutsu": "Akimichi",
  "adamantine_prison_wall_adamantine_nyoi_mugen_sajin_daitouryou": "Uzumaki",
  "adamantine_sealing_chains_sajin_kessho_adamantine_chains": "Uzumaki",
  "basic_sealing_technique_fuinjutsu_kihon": "Uzumaki",
  "bracken_dance_shida_no_mai": "Kaguya",
  "chakra_expandido_chakra_kakudai": "Uzumaki",
  "clematis_dance_flower_tsubaki_no_mai_hana": "Kaguya",
  "clematis_dance_vine_tsubaki_no_mai_kazura": "Kaguya",
  "congelamento_toketsu": "Yuki",
  "corpulencia_akimichi": "Akimichi",
  "demonic_ice_mirrors_makyou_hyoushou": "Yuki",
  "demonio_do_vento_fuuma_no_oni": "Fuuma",
  "genialidade_tensai": "Fuuma",
  "hydration_armor_suirou_no_yoroi": "Hozuki",
  "hydrification_technique_suika_no_jutsu": "Hozuki",
  "hyoton_activation_hyoton_kaika": "Yuki",
  "ice_prison_technique_hyoton_roga_nadare_kesshou": "Yuki",
  "ice_release_ice_spears_hyoton_tsubame_fubuki": "Yuki",
  "jiton_activation_sand_armor_jiton_kaika_suna_yoroi": "Linhagem Kazekage",
  "lava_style_lava_sphere_yoton_yokai_no_jutsu": "Terumi",
  "lava_style_melting_apparition_technique_yoton_youton_seinaru_zue": "Terumi",
  "lamina_da_lua_tsuki_no_yaiba": "Yotsuki",
  "predador_aquatico_suichu_hokushokusha": "Hoshigaki",
  "regeneracao_uzumaki_uzumaki_saisei": "Uzumaki",
  "reserva_de_agua_mizu_no_takuwae": "Hoshigaki",
  "resiliencia_akimichi": "Akimichi",
  "rinkaichuu_inseto_parasita_venenoso_aburame": "Aburame",
  "selos_com_uma_mao_katte_inin": "Yuki",
  "shikotsumyaku_activation_shikotsumyaku_kaika": "Kaguya",
  "ten_finger_drilling_bullets_juuha_sandan_shiki": "Kaguya",
  "uzumaki_sealing_chain_uzumaki_fuuin_kusari": "Uzumaki",
  "vapor_style_acide_mist_futton_komu_hane": "Terumi",
  "water_body_liquid_assault_mizu_karada_ekitai_totsugeki": "Hozuki",
  "willow_dance_yanagi_no_mai": "Kaguya",
  "bringer_of_darkness_meimu_meimu_no_jutsu": "Nara",
  "eight_trigrams_sealing_style_hakke_no_fuuin_shiki": "Uzumaki",
  "enton_chamas_negras_enton_amaterasu": "Uchiha",
  "imortalidade_de_jashin_fushosei": "Uzumaki",
  "kotoamatsukami_kotoamatsukami_no_jutsu": "Uchiha",
  "mokuton_supressao_de_bijuu_mokuton_rinbo": "Senju",
  "susanoo_susanoo_no_yoroi": "Uchiha"
};

/** nome do cla -> objeto de descricao (busca rapida) */
export const CLAN_BY_NAME = Object.fromEntries(CLANS.map((c) => [c.name, c]));

/** cla exigido por um jutsu (ou null) */
export function clanRequiredFor(sourceId) {
  return JUTSU_CLAN[sourceId] ?? null;
}
